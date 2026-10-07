const CRILO_SUPABASE_URL = "https://mqozqigwkobnhijvvboy.supabase.co";
const CRILO_SUPABASE_KEY = "sb_publishable__AqZ1h05YLDbnKZf8FC-Tw_WahZdQot";
const criloDB = window.supabase.createClient(CRILO_SUPABASE_URL, CRILO_SUPABASE_KEY, {
  auth: {
    flowType: "implicit",
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true
  }
});
