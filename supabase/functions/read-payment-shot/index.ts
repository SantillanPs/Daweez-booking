// **Reads a payment screenshot** (Sebastian, 2026-11-17: "auto extracting the reference number just from uploading
// a screenshot"). The website uploads the guest's GCash or bank receipt to the private `payment-shots` bucket, then
// asks this function what it says: the reference number and who it was sent to. The guest only checks the
// reference box instead of typing it, and the desk's panel checks the rest against the request. Reading it proves
// nothing: the desk still finds the money in the app. Anything that fails here answers {} and the guest types it.
//
// Called by anyone (the website has no login), so verify_jwt is off; it only reads a file already in the bucket,
// by its uuid name. Secrets: GEMINI_API_KEY, or the bot's LLM_API_KEY when that is a Gemini key.
// SHOT_MODELS (comma-separated, tried in order) overrides the models.

const env = (k: string) => Deno.env.get(k) || ""
const URL_ = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
const MODELS = (env("SHOT_MODELS") || "gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-2.5-flash").split(",").map(m => m.trim()).filter(Boolean)
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } })

// Only the reference and the account it went to (Sebastian, 2026-11-19): the amount is what the guest picked, and the
// desk finds it in the app.
const ASK = `This is a screenshot of a payment receipt from GCash or a Philippine bank app (BPI, Landbank, or another).
Answer only with JSON: {"reference": string|null, "sent_to_name": string|null, "sent_to_number": string|null}.
reference is the transaction's reference number exactly as shown (digits and spaces).
sent_to_name and sent_to_number are the receiver's name and account or mobile number as shown.
If this is not a payment receipt, answer {}.`

function b64(bytes: Uint8Array) {
  let s = ""
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS })
  if (req.method !== "POST") return json({}, 405)
  let path: string
  try { path = String((await req.json()).path || "") } catch { return json({}, 400) }
  if (!/^[0-9a-f-]{36}\.[a-z]{3,4}$/.test(path)) return json({}, 400)

  const file = await fetch(`${env("SUPABASE_URL")}/storage/v1/object/payment-shots/${path}`, {
    headers: { Authorization: "Bearer " + env("SUPABASE_SERVICE_ROLE_KEY") },
  })
  if (!file.ok) return json({})
  const type = file.headers.get("content-type") || "image/jpeg"
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.length > 6 * 1024 * 1024) return json({})
  const image = `data:${type};base64,${b64(bytes)}`
  const key = env("GEMINI_API_KEY") || env("LLM_API_KEY")

  for (const model of MODELS) {
    try {
      const r = await fetch(URL_, {
        method: "POST", signal: AbortSignal.timeout(8000),
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({
          model, temperature: 0, response_format: { type: "json_object" },
          messages: [{ role: "user", content: [{ type: "text", text: ASK }, { type: "image_url", image_url: { url: image } }] }],
        }),
      })
      if (!r.ok) continue
      const text = (await r.json()).choices?.[0]?.message?.content || "{}"
      const got = JSON.parse(text.replace(/^```(json)?|```$/g, "").trim())
      const clean = (v: unknown, n = 80) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null)
      return json({
        reference: clean(got.reference, 40),
        sent_to_name: clean(got.sent_to_name),
        sent_to_number: clean(got.sent_to_number, 40),
      })
    } catch { /* the next model */ }
  }
  return json({})
})
