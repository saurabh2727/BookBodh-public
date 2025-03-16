
// Follow the steps below to run locally:
// 1. deno install -Arf -n supabase https://deno.land/x/supabase/cli/bin/supabase.ts
// 2. supabase functions serve chat-response --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const GROK_API_KEY = Deno.env.get('GROK_API_KEY') || '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';

interface RequestPayload {
  query: string;
  book?: string | null;
  chunks?: Array<{
    title: string;
    author: string;
    text: string;
  }>;
}

interface ChatCompletion {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client for the function context
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const { query, book, chunks } = await req.json() as RequestPayload;

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Format context from chunks
    let context = '';
    let bookTitle = null;
    let bookAuthor = null;
    const book_citations = {};

    if (chunks && chunks.length > 0) {
      chunks.forEach((chunk, i) => {
        context += `\nChunk ${i+1} from '${chunk.title}' by ${chunk.author}:\n${chunk.text}\n`;
        // @ts-ignore
        book_citations[chunk.title] = chunk.author;
        
        // Use the first chunk's book info as the citation if not already set
        if (!bookTitle) {
          bookTitle = chunk.title;
          bookAuthor = chunk.author;
        }
      });
    }

    // Create prompt for Grok
    const prompt = `Answer the query: '${query}' using this context: 
    
${context}

Always cite the book and author when referencing information from the texts. 
If the answer cannot be found in the provided context, indicate that clearly.
Provide a thoughtful, well-reasoned response with quotations from the book where appropriate.`;

    // Call Grok API
    const grokResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'You are a helpful assistant that provides insights from books.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!grokResponse.ok) {
      const errorText = await grokResponse.text();
      throw new Error(`Grok API error: ${grokResponse.status} - ${errorText}`);
    }

    const grokData = await grokResponse.json() as ChatCompletion;
    const responseText = grokData.choices[0].message.content;

    // Determine which book was cited (simple approach)
    let citedBook = bookTitle;
    let citedAuthor = bookAuthor;

    // Save chat history to database
    const { error: insertError } = await supabaseClient
      .from('chat_history')
      .insert({
        user_id: user.id,
        query,
        response: responseText,
        book: citedBook,
        author: citedAuthor
      });

    if (insertError) {
      console.error('Error saving chat history:', insertError);
    }

    // Return the response
    return new Response(
      JSON.stringify({
        response: responseText,
        book: citedBook,
        author: citedAuthor
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
