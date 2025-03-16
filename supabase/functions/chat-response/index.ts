// Follow the steps below to run locally:
// 1. deno install -Arf -n supabase https://deno.land/x/supabase/cli/bin/supabase.ts
// 2. supabase functions serve chat-response --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const GROK_API_KEY = Deno.env.get('GROK_API_KEY') || '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';
const MAX_TOKENS = 5000; // Setting a safe limit below the 6000 TPM limit

interface RequestPayload {
  query: string;
  book?: string | null;
  bookId?: string | null;
  chunks?: Array<{
    title: string;
    author: string;
    text: string;
    summary?: string;
  }>;
}

interface ChatCompletion {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Helper function to estimate token count (rough estimate: 1 token ~ 4 characters)
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

// Helper function to truncate context while preserving whole chunks if possible
function truncateContext(chunks: Array<{title: string, author: string, text: string, summary?: string}>, maxTokens: number): string {
  let context = '';
  let totalTokens = 0;
  const chunkIntros: string[] = [];
  const summaries: string[] = [];
  
  // First prepare the chunk intros and summaries separately
  chunks.forEach((chunk, i) => {
    const chunkIntro = `\nChunk ${i+1} from '${chunk.title || 'Unknown'}' by ${chunk.author || 'Unknown'}: `;
    const contentToUse = chunk.summary || chunk.text?.substring(0, 200) || 'No content available';
    
    chunkIntros.push(chunkIntro);
    summaries.push(contentToUse);
  });
  
  // Now build the context, adding chunks until we reach token limit
  for (let i = 0; i < chunks.length; i++) {
    const nextChunkIntro = chunkIntros[i];
    const nextSummary = summaries[i];
    const nextChunkTokens = estimateTokenCount(nextChunkIntro + nextSummary);
    
    // If adding this chunk would exceed the limit, stop
    if (totalTokens + nextChunkTokens > maxTokens) {
      break;
    }
    
    // Add the chunk to the context
    context += nextChunkIntro + nextSummary + '\n';
    totalTokens += nextChunkTokens;
  }
  
  console.log(`Built context with approximately ${totalTokens} tokens`);
  return context;
}

// Implement retrying with exponential backoff
async function callGrokWithRetry(prompt: string, maxRetries = 3): Promise<ChatCompletion> {
  let retries = 0;
  let delay = 1000; // Start with 1 second delay
  
  while (retries < maxRetries) {
    try {
      console.log(`Calling Grok API (attempt ${retries + 1})`);
      
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

      if (grokResponse.status === 429) {
        // Rate limit error, retry with backoff
        console.log(`Received 429 rate limit error, retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        retries++;
        continue;
      }

      if (!grokResponse.ok) {
        const errorText = await grokResponse.text();
        console.error(`Grok API error: ${grokResponse.status} - ${errorText}`);
        throw new Error(`Grok API error: ${grokResponse.status} - ${errorText}`);
      }

      return await grokResponse.json() as ChatCompletion;
    } catch (error) {
      if (retries >= maxRetries - 1) {
        throw error; // Re-throw the error if we've exhausted our retries
      }
      
      console.log(`Error calling Grok API: ${error.message}, retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
      retries++;
    }
  }
  
  throw new Error('Maximum retries exceeded');
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Processing chat request');
    
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
      error: userError
    } = await supabaseClient.auth.getUser();

    if (userError) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: `Authentication error: ${userError.message}` }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

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
    const requestData = await req.json().catch(err => {
      console.error('Error parsing request body:', err);
      throw new Error('Invalid request body');
    });
    
    const { query, book, bookId, chunks: providedChunks } = requestData as RequestPayload;

    console.log('Request details:', { query, book, bookId, hasProvidedChunks: !!providedChunks });

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Handle general chat (no book selected)
    if (!bookId && !book) {
      console.log('Processing general chat query');
      
      try {
        const grokData = await callGrokWithRetry(`You are BookBodh, a helpful AI assistant that can answer general questions. 
          Please respond to this query: ${query}`);
        
        const responseText = grokData.choices[0].message.content;
        
        // Save chat history to database
        try {
          const { error: insertError } = await supabaseClient
            .from('chat_history')
            .insert({
              user_id: user.id,
              query,
              response: responseText,
              book: null,
              author: null
            });

          if (insertError) {
            console.error('Error saving chat history:', insertError);
          }
        } catch (err) {
          console.error('Error in chat history insertion:', err);
        }
        
        return new Response(
          JSON.stringify({
            response: responseText,
            book: null,
            author: null
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (grokError) {
        console.error('Grok API error in general chat:', grokError);
        return new Response(
          JSON.stringify({ error: `Error calling AI service: ${grokError.message}` }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Check if bookId is provided, return error if not
    if (!bookId) {
      return new Response(
        JSON.stringify({ error: 'No book selected' }),
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
    let chunks = providedChunks || [];
    
    // If bookId is provided, fetch chunks from the database
    if (bookId && !chunks.length) {
      console.log(`Fetching chunks for book ID: ${bookId}`);
      
      try {
        // First get the book details
        const { data: bookData, error: bookError } = await supabaseClient
          .from('books')
          .select('title, author')
          .eq('id', bookId)
          .single();
          
        if (bookError) {
          console.error('Error fetching book:', bookError);
          return new Response(
            JSON.stringify({ error: `Error fetching book: ${bookError.message}` }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        
        if (!bookData) {
          console.error('Book not found');
          return new Response(
            JSON.stringify({ error: `Book not found with ID: ${bookId}` }),
            {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        
        console.log('Book data found:', bookData);
        bookTitle = bookData.title;
        bookAuthor = bookData.author;
        
        // Then get the chunks
        const { data: chunkData, error: chunkError } = await supabaseClient
          .from('book_chunks')
          .select('chunk_index, title, text, summary')
          .eq('book_id', bookId)
          .order('chunk_index');
          
        if (chunkError) {
          console.error('Error fetching chunks:', chunkError);
          return new Response(
            JSON.stringify({ error: `Error fetching chunks: ${chunkError.message}` }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        
        console.log(`Found ${chunkData?.length || 0} chunks for book ID: ${bookId}`);
        
        if (chunkData && chunkData.length > 0) {
          chunks = chunkData.map(chunk => ({
            title: chunk.title || bookData.title,
            author: bookData.author,
            text: chunk.text,
            summary: chunk.summary || chunk.text.substring(0, 200) + '...'
          }));
        } else {
          console.log('No chunks found for book');
          return new Response(
            JSON.stringify({ error: `No content found for the selected book. Please try uploading it again.` }),
            {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      } catch (err) {
        console.error('Error in bookId processing:', err);
        return new Response(
          JSON.stringify({ error: `Error processing book data: ${err.message}` }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }
    // We've removed the block that fetches all books for general context

    console.log(`Processing ${chunks.length} chunks for context`);
    const book_citations: Record<string, string> = {};

    if (chunks && chunks.length > 0) {
      chunks.forEach((chunk, i) => {
        if (!chunk.title || !chunk.author) {
          console.warn(`Missing title or author for chunk ${i}`);
        }
        
        // Use the first chunk's book info as the citation if not already set
        if (!bookTitle) {
          bookTitle = chunk.title;
          bookAuthor = chunk.author;
        }
        
        book_citations[chunk.title || 'Unknown'] = chunk.author || 'Unknown';
      });
      
      // Build and truncate context to fit token limits
      context = truncateContext(chunks, MAX_TOKENS);
    } else {
      console.log('No chunks available for context');
      return new Response(
        JSON.stringify({ error: `No content available for the selected book.` }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create prompt for Grok - restricting to book's content only
    const prompt = `Answer the query: '${query}' using ONLY the information provided in the following context: 
    
${context}

Answer ONLY based on the information in the context. If the answer cannot be found in the provided context, say "I don't have enough information about that in this book."
Always cite the book and author when referencing information from the texts.
Provide a thoughtful, well-reasoned response with quotations from the book where appropriate.`;

    console.log(`Prompt length: ${prompt.length} characters (approximately ${estimateTokenCount(prompt)} tokens)`);
    
    // Call Grok API with retry logic
    try {
      const grokData = await callGrokWithRetry(prompt);
      const responseText = grokData.choices[0].message.content;
      console.log('Got response from Grok API');

      // Determine which book was cited
      let citedBook = bookTitle;
      let citedAuthor = bookAuthor;

      // Save chat history to database
      try {
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
      } catch (err) {
        console.error('Error in chat history insertion:', err);
        // Continue rather than failing if chat history can't be saved
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
    } catch (grokError) {
      console.error('Grok API error:', grokError);
      return new Response(
        JSON.stringify({ error: `Error calling AI service: ${grokError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
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
