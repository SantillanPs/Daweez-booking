// The guests' chat bot (2026-11-12; docs/why/booking.md, "Guests asking on WhatsApp"). Meta posts each guest
// message here, from the hotel's Facebook page (Messenger) or WhatsApp; the AI answers in the guest's
// language (English, Cebuano, Tagalog), says which rooms are free and what they cost, asks for half the stay
// as the deposit, and leaves a booking request for the desk. It never writes `bookings`: the desk turns a
// request into a booking (`RequestPanel`). The name stays `whatsapp-bot` because Meta already points at it.
//
// Messenger is where guests write (Sebastian, 2026-11-12: "the guests message the facebook page of the hotel,
// and the ai responds"). Meta's own page AI cannot read the system, so this one answers in its place.
//
// The AI is any OpenAI-style chat endpoint (Sebastian, 2026-11-12: "let's use a gemini api key first or a
// deepseek api key"). LLM_API_KEY, plus LLM_BASE_URL and LLM_MODEL to move off the default, Gemini:
//   Gemini    https://generativelanguage.googleapis.com/v1beta/openai   gemini-2.5-flash
//   DeepSeek  https://api.deepseek.com                                  deepseek-chat
//
// Other secrets: MESSENGER_PAGE_TOKEN (the page's access token), WHATSAPP_TOKEN and WHATSAPP_PHONE_ID (only
// for WhatsApp), WHATSAPP_APP_SECRET (the Meta app's secret, both channels), WHATSAPP_VERIFY_TOKEN (the
// webhook's verify token, both channels), and DEPOSIT_METHODS (how a guest can pay, in plain words; until it
// is set the bot says the desk will send them).
// Deployed with verify_jwt off: Meta signs every post instead (X-Hub-Signature-256).
import { createClient } from "jsr:@supabase/supabase-js@2"

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

const env = (k: string) => Deno.env.get(k) ?? ""
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"))
const LLM_URL = (env("LLM_BASE_URL") || "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/$/, "") + "/chat/completions"
// An older, steadier model first (Sebastian, 2026-11-12: "can we use an older model?"): the newest was busy.
const LLM_MODEL = env("LLM_MODEL") || "gemini-2.5-flash"

const manilaToday = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10)

// Who the bot is talking to. `key` names the chat in `whatsapp_turns.phone`: the phone number on WhatsApp,
// "fb:" and the page-scoped id on Messenger, which carries no phone number.
type Channel = "whatsapp" | "messenger"
type Chat = { channel: Channel; key: string; to: string }

const SYSTEM = `You answer guests of Daweez Pension House in Tandag City, Surigao del Sur, Philippines, in a chat.
It has 10 rooms and venues for events (Gazebo, Vacation House, Garden Area). Open 24 hours.
Check-in is 2 PM, check-out is 12 noon.

How to help:
- Reply in the language the guest writes in: English, Cebuano (Bisaya) or Tagalog. Short, warm, plain messages; this is a chat, not an email. No markdown: no headings, tables or * bullets (the chat shows the stars); one room per line is enough.
- Before naming any room or price, call find_free_rooms for the guest's dates. Never promise a room it did not return. Prices are in pesos.
- A venue's price is a starting price per day; the front desk confirms the exact kind and price for an event.
- When the guest picks a room, get their full name, then call save_request right away, in that same reply.
- Never say a request is saved, and never give the deposit, until save_request has answered "Saved" in this conversation; saying you will save it is not saving it. After saving, tell them the deposit is half the stay (give the amount), and how they can pay: ${env("DEPOSIT_METHODS") || "the front desk will send the payment details"}. Say the front desk will confirm the booking once the deposit is received. Nothing is booked until then.
- If you do not know something (amenities, directions, special requests), say the front desk will reply, and save their question as the note if they are making a request.
- Never make up rooms, prices, discounts or rules.`

const ON = {
  whatsapp: "This chat is on WhatsApp: their phone number is already known, so do not ask for it.",
  messenger: "This chat is on Facebook Messenger: the desk cannot see their phone number, so ask for it together with their name, and pass it to save_request as phone.",
}

const TOOLS = [
  {
    type: "function", function: {
    name: "find_free_rooms",
    description: "Rooms and venues free for a stay, with the price a night (a day for venues) and the total. Dates are YYYY-MM-DD; check_out is the day they leave.",
    parameters: {
      type: "object",
      properties: { check_in: { type: "string" }, check_out: { type: "string" } },
      required: ["check_in", "check_out"],
    },
  } },
  {
    type: "function", function: {
    name: "save_request",
    description: "Leave a booking request for the front desk to confirm. Call once the guest has picked a room from find_free_rooms and given their name (and, on Messenger, their phone number).",
    parameters: {
      type: "object",
      properties: {
        room_id: { type: "string", description: "The id from find_free_rooms, e.g. room-3" },
        check_in: { type: "string" },
        check_out: { type: "string" },
        guest_name: { type: "string" },
        phone: { type: "string", description: "The guest's phone number, on Messenger only" },
        guests: { type: "integer", description: "How many people, if they said" },
        note: { type: "string", description: "Anything the desk should know, in English" },
        language: { type: "string", enum: ["English", "Cebuano", "Tagalog"] },
      },
      required: ["room_id", "check_in", "check_out", "guest_name", "language"],
    },
  } },
]

const isDay = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)

// On WhatsApp the tools use the guest's own number, never one the model writes.
async function runTool(name: string, input: Record<string, unknown>, chat: Chat): Promise<string> {
  if (!isDay(input.check_in) || !isDay(input.check_out)) return "Dates must be YYYY-MM-DD."
  if (name === "find_free_rooms") {
    const { data, error } = await db.rpc("free_units", { p_check_in: input.check_in, p_check_out: input.check_out })
    if (error) throw error
    return data.length ? JSON.stringify(data) : "Nothing is free for those dates."
  }
  const phone = chat.channel === "whatsapp" ? chat.key : String(input.phone ?? "")
  if (phone.replace(/\D/g, "").length < 7) return "Ask the guest for their phone number first, then call save_request with it."
  // The quote is worked out here, not taken from the model.
  const { data: units } = await db.rpc("free_units", { p_check_in: input.check_in, p_check_out: input.check_out })
  const unit = (units ?? []).find((u: { id: string }) => u.id === input.room_id)
  if (!unit) return "That room is not free for those dates any more. Call find_free_rooms again."
  const { error } = await db.rpc("request_booking", {
    p_source: chat.channel, p_room_id: input.room_id, p_check_in: input.check_in, p_check_out: input.check_out,
    p_guest_name: input.guest_name, p_phone: phone, p_guests: input.guests ?? null, p_note: input.note ?? null,
    p_quoted_total: unit.total, p_language: input.language,
  })
  if (error) return "Could not save: " + error.message + ". BAD_DATES means past or wrong dates; BAD_DETAILS means the name or phone number is missing or wrong; TOO_MANY_REQUESTS means they already have requests waiting for the desk."
  return `Saved for the front desk. Total ₱${unit.total}, deposit (half) ₱${unit.total / 2}.`
}

type Msg = { role: string; content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[]; tool_call_id?: string }

// The first test (2026-11-12) found gemini-3.8-flash busy (503) and then silent past 90 seconds, and a
// guest left waiting gets nothing. So each call gives up after 25 seconds, and a busy or slow model hands
// the question to the next one: LLM_MODEL, then LLM_FALLBACK_MODEL. The free key allows only a few calls a
// minute, so the second model is also what answers when the first is out of calls (429).
const MODELS = [LLM_MODEL, env("LLM_FALLBACK_MODEL") || "gemini-3.5-flash-lite"]
async function ask(messages: Msg[]): Promise<Msg> {
  let last = ""
  for (const model of MODELS) {
    const t0 = Date.now()
    try {
      const r = await fetch(LLM_URL, {
        method: "POST",
        headers: { Authorization: "Bearer " + env("LLM_API_KEY"), "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, tools: TOOLS }),
        signal: AbortSignal.timeout(25_000),
      })
      console.log("AI", model, r.status, Date.now() - t0, "ms")
      if (r.ok) return (await r.json()).choices?.[0]?.message
      last = model + " " + r.status + ": " + (await r.text()).slice(0, 300)
      if (![429, 500, 503, 504].includes(r.status)) break // a wrong key or request: another model will not help
    } catch (e) {
      last = model + ": " + String(e) + " after " + (Date.now() - t0) + " ms"
    }
  }
  throw new Error("AI " + last)
}

// One guest message in, one reply out. The chat so far comes from `whatsapp_turns` (3 days, 20 messages),
// the guest's new message included: `handle` saves it first.
async function reply(chat: Chat): Promise<string> {
  const { data: past } = await db.from("whatsapp_turns").select("role, text").eq("phone", chat.key)
    .gt("created_at", new Date(Date.now() - 3 * 86400_000).toISOString()).order("id", { ascending: false }).limit(20)
  const messages: Msg[] = [
    { role: "system", content: SYSTEM + `
- ${ON[chat.channel]}

Today is ${manilaToday()} (Philippine time).` },
    ...(past ?? []).reverse().map(t => ({ role: t.role as string, content: t.text as string })),
  ]

  for (let step = 0; step < 6; step++) {
    const said = await ask(messages)
    if (!said?.tool_calls?.length) return said?.content?.trim() || "Salamat! The front desk will reply to you shortly."
    // Sent back as it came: Gemini 3 hides a signature on each tool call that must come back unchanged.
    messages.push(said)
    for (const call of said.tool_calls) {
      let out: string
      try {
        out = await runTool(call.function.name, JSON.parse(call.function.arguments || "{}"), chat)
      } catch (e) {
        out = "Error: " + String(e)
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: out })
    }
  }
  return "Salamat! The front desk will reply to you shortly."
}

async function handle(chat: Chat, text: string, msgId: string | null): Promise<string | null> {
  // Meta can deliver one message twice; the unique message id lets only the first through.
  const { error } = await db.from("whatsapp_turns").insert({ phone: chat.key, role: "user", text, wamid: msgId })
  if (error) return null
  const answer = await reply(chat)
  await db.from("whatsapp_turns").insert({ phone: chat.key, role: "assistant", text: answer })
  return answer
}

async function send(chat: Chat, body: string) {
  const r = chat.channel === "messenger"
    ? await fetch("https://graph.facebook.com/v21.0/me/messages", {
        method: "POST",
        headers: { Authorization: "Bearer " + env("MESSENGER_PAGE_TOKEN"), "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { id: chat.to }, messaging_type: "RESPONSE", message: { text: body.slice(0, 2000) } }),
      })
    : await fetch(`https://graph.facebook.com/v21.0/${env("WHATSAPP_PHONE_ID")}/messages`, {
        method: "POST",
        headers: { Authorization: "Bearer " + env("WHATSAPP_TOKEN"), "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: chat.to, type: "text", text: { body: body.slice(0, 4000) } }),
      })
  if (!r.ok) console.error(chat.channel + " send failed", r.status, await r.text())
}

async function signedByMeta(raw: string, header: string | null) {
  const secret = env("WHATSAPP_APP_SECRET")
  if (!secret || !header?.startsWith("sha256=")) return false
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)))
  const hex = [...sig].map(b => b.toString(16).padStart(2, "0")).join("")
  const given = header.slice(7)
  return hex.length === given.length && [...hex].reduce((d, c, i) => d | (c.charCodeAt(0) ^ given.charCodeAt(i)), 0) === 0
}

// What Meta posted, as guest messages: Messenger sends `object: "page"`, WhatsApp `whatsapp_business_account`.
// Delivery and read receipts, and the page's own replies (echoes), carry no guest text and are dropped.
type Incoming = { chat: Chat; text: string; id: string }
// deno-lint-ignore no-explicit-any
function incoming(body: any): Incoming[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  const out: Incoming[] = []
  for (const entry of body?.entry ?? []) {
    if (body.object === "page") {
      for (const ev of entry.messaging ?? []) {
        const m = ev.message
        if (!m || m.is_echo || !ev.sender?.id) continue
        // ponytail: text only; a photo or voice note gets a polite line, add media when guests send them often.
        const text = m.text ?? "(The guest sent a photo or file, which the bot cannot read.)"
        out.push({ chat: { channel: "messenger", key: "fb:" + ev.sender.id, to: ev.sender.id }, text, id: m.mid })
      }
    } else {
      for (const change of entry.changes ?? []) {
        for (const m of change.value?.messages ?? []) {
          const text = m.type === "text" ? m.text.body : "(The guest sent a " + m.type + ", which the bot cannot read.)"
          out.push({ chat: { channel: "whatsapp", key: m.from, to: m.from }, text, id: m.id })
        }
      }
    }
  }
  return out
}

Deno.serve(async req => {
  const url = new URL(req.url)
  const verify = env("WHATSAPP_VERIFY_TOKEN")

  // Meta checks the address once, when the webhook is set up.
  if (req.method === "GET") {
    const ok = verify && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === verify
    return ok ? new Response(url.searchParams.get("hub.challenge") ?? "") : new Response("Forbidden", { status: 403 })
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })

  const raw = await req.text()

  // A test from the desk's side, without Meta: {"phone": "...", "text": "...", "channel": "messenger"?} with
  // x-test-key = the verify token. The reply comes back in the response instead of in the chat.
  if (req.headers.get("x-test-key")) {
    if (!verify || req.headers.get("x-test-key") !== verify) return new Response("Forbidden", { status: 403 })
    const { phone, text, channel } = JSON.parse(raw)
    const chat: Chat = channel === "messenger"
      ? { channel: "messenger", key: "fb:" + phone, to: String(phone) }
      : { channel: "whatsapp", key: String(phone), to: String(phone) }
    try {
      return Response.json({ reply: await handle(chat, String(text), null) })
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 })
    }
  }

  if (!(await signedByMeta(raw, req.headers.get("x-hub-signature-256")))) return new Response("Forbidden", { status: 403 })
  const messages = incoming(JSON.parse(raw))
  // Meta wants a quick 200, so the answers are written after the response goes back.
  // ponytail: two messages sent seconds apart run side by side; queue per chat if replies cross.
  for (const { chat, text, id } of messages) {
    EdgeRuntime.waitUntil((async () => {
      try {
        const answer = await handle(chat, text, id)
        if (answer) await send(chat, answer)
      } catch (e) {
        console.error(e)
        await send(chat, "Pasensya, something went wrong on our side. The front desk will reply to you shortly.")
      }
    })())
  }
  return new Response("ok")
})
