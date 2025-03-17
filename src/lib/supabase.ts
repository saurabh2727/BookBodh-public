
import { createClient } from '@supabase/supabase-js';

// Use the hardcoded values provided by the user
const supabaseUrl = 'https://qpmtpttswnipduzpuaen.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwbXRwdHRzd25pcGR1enB1YWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE5Mjg2NzYsImV4cCI6MjA1NzUwNDY3Nn0.vOPRS4EIoSYc7t3o56eTw5LvLLbUkyfdC4e2zTWpzBk';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase URL or Anon Key.');
}

// Create a single client instance to avoid duplicate client warnings
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

