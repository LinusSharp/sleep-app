import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://xoebnpamcxgtrjhqzzbn.supabase.co"; // your project URL
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvZWJucGFtY3hndHJqaHF6emJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxODQyMjQsImV4cCI6MjA3ODc2MDIyNH0.hvcwjnxOHIlIXKNOrGsMSLega3IP89CTnMRoR95eCUQ"; // from Supabase > Project Settings > API

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
