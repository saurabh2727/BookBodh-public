
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
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Explicitly use localStorage for session storage
    storage: localStorage
  }
});

// Enhanced getAuthHeader function with better logging and error handling
export const getAuthHeader = async () => {
  try {
    console.log('Getting auth header from session...');
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error getting session:', error);
      return undefined;
    }
    
    if (!data.session) {
      // Try to refresh the session if it's not found
      const { data: refreshData } = await supabase.auth.refreshSession();
      
      // If we still don't have a session after attempting refresh
      if (!refreshData.session) {
        console.warn('No active session found after refresh attempt');
        return undefined;
      }
      
      console.log('Session refreshed successfully');
      return `Bearer ${refreshData.session.access_token}`;
    }
    
    const token = data.session.access_token;
    
    if (!token) {
      console.error('Session exists but no access token found');
      return undefined;
    }
    
    // Log token details (partial for security)
    console.log('Access token obtained:', {
      length: token.length,
      prefix: token.substring(0, 10) + '...',
      expires: new Date(data.session.expires_at * 1000).toLocaleString()
    });
    
    return `Bearer ${token}`;
  } catch (error) {
    console.error('Unexpected error in getAuthHeader:', error);
    return undefined;
  }
};

// Add a function to check and refresh auth if needed
export const ensureAuthIsValid = async () => {
  try {
    const { data } = await supabase.auth.getSession();
    
    if (!data.session) {
      console.warn('No active session in ensureAuthIsValid');
      return false;
    }
    
    // Check if token is about to expire (within 5 minutes)
    const expiresAt = data.session.expires_at;
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const fiveMinutesInSeconds = 5 * 60;
    
    if (expiresAt - nowInSeconds < fiveMinutesInSeconds) {
      console.log('Token is about to expire, refreshing...');
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('Error refreshing session:', refreshError);
        return false;
      }
      
      console.log('Session refreshed successfully');
    }
    
    return true;
  } catch (error) {
    console.error('Error in ensureAuthIsValid:', error);
    return false;
  }
};
