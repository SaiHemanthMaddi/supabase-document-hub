export function isSupabaseConfigured() {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY &&
    import.meta.env.VITE_SUPABASE_URL !== "https://your-supabase-url.supabase.co" &&
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY !== "your-supabase-publishable-key" &&
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY !== "REPLACE_WITH_NEW_SUPABASE_ANON_KEY"
  );
}
