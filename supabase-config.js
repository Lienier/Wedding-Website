// Supabase browser configuration.
// Replace these values with the Project URL and anon/public key from:
// Supabase Dashboard → Project Settings → API
window.SUPABASE_URL = "https://nqhvtbggxcopvnlnxazf.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_RrC1jYYSWgBv-XVJxzCAcg_dZYwOS12";

window.getSupabaseClient = function(){
  if(!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY){
    return null;
  }
  return window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
};
