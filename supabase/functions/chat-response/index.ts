
// Follow the steps below to run locally:
// 1. deno install -Arf -n supabase https://deno.land/x/supabase/cli/bin/supabase.ts
// 2. supabase functions serve chat-response --no-verify-jwt

import { serve } from 'https://deno.land/std@0.131.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Function to sanitize HTML content
function sanitizeHtml(text: string): string {
  if (!text) return '';
  
  // First unescape HTML entities (would need a proper library for this in production)
  // This is a simplified approach
  const unescaped = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Remove HTML tags using a simple approach
  return unescaped.replace(/<\/?[^>]+(>|$)/g, "");
}

// Main function to process chat requests
serve(async (req) => {
  console.log("Edge function invoked: chat-response");
  
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log("Processing request...");
    
    // Create Supabase client using auth from header
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      console.log("No authorization header provided");
      return new Response(
        JSON.stringify({ error: 'No authorization header provided' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Setup Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } }
      }
    );

    // Parse request body
    const requestData = await req.json();
    const {
      query,
      book: bookTitle,
      bookId,
      chunks: providedChunks
    } = requestData;
    
    console.log('Request received:', {
      query,
      bookTitle,
      bookId,
      hasChunks: !!providedChunks,
      chunkCount: providedChunks?.length
    });

    if (!query || query.trim() === '') {
      console.log("Query is required but was empty");
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Make a direct call to our backend FastAPI
    try {
      // Use Deno's built-in fetch method to call our FastAPI backend
      console.log("Calling FastAPI backend for chat processing");
      
      const apiUrl = Deno.env.get("BACKEND_API_URL") || "http://localhost:8000";
      console.log(`Using backend API URL: ${apiUrl}`);
      
      const backendResponse = await fetch(`${apiUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          book: bookTitle,
          bookId,
          chunks: providedChunks
        }),
      });
      
      console.log(`Backend API response status: ${backendResponse.status}`);
      
      if (backendResponse.ok) {
        const responseData = await backendResponse.json();
        console.log("Successfully received response from backend API");
        
        return new Response(
          JSON.stringify(responseData),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } else {
        const errorText = await backendResponse.text();
        console.error(`Error from backend API: ${errorText}`);
        
        // Fall back to built-in response if backend fails
        console.log("Falling back to edge function built-in response");
      }
    } catch (backendError) {
      console.error(`Error calling backend API: ${backendError.message}`);
      console.log("Falling back to edge function built-in response");
    }
    
    // Fallback: Use provided chunks if available, or an empty response
    const chunks = providedChunks || [];
    const sanitizedChunks = chunks.map(chunk => ({
      ...chunk,
      text: sanitizeHtml(chunk.text || "")
    }));
    
    // Default fallback response
    let response = `I'm sorry, but I couldn't process your query about "${bookTitle || 'your topic'}". There seems to be a technical issue.`;
    
    // If we have chunks, provide a better fallback response
    if (sanitizedChunks.length > 0) {
      response = `Based on "${bookTitle}", I found some relevant information but couldn't generate a complete response. Please try again later or rephrase your question.`;
    }
    
    return new Response(
      JSON.stringify({
        response,
        book: bookTitle,
        author: sanitizedChunks.length > 0 ? sanitizedChunks[0].author : null,
        bookId,
        error: "Backend API unavailable"
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({
        response: 'I encountered an error processing your request. Please try again.',
        book: null,
        author: null,
        error: `Server error: ${error.message || "Unknown error"}`
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
