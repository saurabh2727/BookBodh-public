
import { ChatRequest, ChatResponse } from '../types';
import { supabase } from '@/integrations/supabase/client';

/**
 * Sends a chat request to the Supabase Edge Function
 * @param request The chat request with query and optional book
 * @returns Promise with the chat response
 */
export const sendChatRequest = async (request: ChatRequest): Promise<ChatResponse> => {
  try {
    console.log('Sending chat request to Supabase Edge Function');
    console.log('Request payload:', JSON.stringify(request));
    
    // Get the current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('User not authenticated');
    }
    
    const { data, error } = await supabase.functions.invoke('chat-response', {
      method: 'POST',
      body: request,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(error.message || 'Error calling chat response function');
    }

    console.log('Server response:', data);
    return data as ChatResponse;
  } catch (error) {
    console.error('Chat request error:', error);
    throw error;
  }
};

/**
 * Checks if the user is authenticated
 * @returns Promise with the session data
 */
export const checkAuth = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

/**
 * Signs in with email and password
 * @param email User email
 * @param password User password
 */
export const signInWithEmail = async (email: string, password: string) => {
  return supabase.auth.signInWithPassword({ email, password });
};

/**
 * Signs up with email and password
 * @param email User email
 * @param password User password
 */
export const signUpWithEmail = async (email: string, password: string) => {
  return supabase.auth.signUp({ email, password });
};

/**
 * Signs out the current user
 */
export const signOut = async () => {
  return supabase.auth.signOut();
};
