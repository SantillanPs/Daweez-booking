const { createClient } = require('@supabase/supabase-js');
const url = process.env.VITE_SUPABASE_URL || 'https://ctbqxcxqfsrbgzfcmntw.supabase.co';
const key = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0YnF4Y3hxZnNyYmd6ZmNtbnR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMTA3NzMsImV4cCI6MjA5NTc4Njc3M30.AAYUl2MTdMcSShx-UX4LKuNNV5GhtWwX_4kqk8PC34M';
const supabase = createClient(url, key);

const channel = supabase.channel('test-realtime')
  .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'bookings' }, (payload) => {
    console.log('DELETE PAYLOAD:', JSON.stringify(payload));
    process.exit(0);
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Subscribed. Triggering Edge function...');
      const { data, error } = await supabase.functions.invoke('sync-ical');
      console.log('Edge function response:', { data, error });
    }
  });
