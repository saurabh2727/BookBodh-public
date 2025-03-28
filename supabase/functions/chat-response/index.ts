
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

// For fake chat (we'll use actual LLM logic in real implementation)
const INTRO_PROMPTS = [
  "I'd be happy to discuss this book with you! What would you like to know about it?",
  "This book has some fascinating themes. What aspects interest you the most?",
  "This is an excellent choice! What questions do you have about this book?",
  "I've analyzed this book in detail. What specific information are you looking for?",
  "I can provide insights on themes, characters, or plot elements. What would you like to explore?",
];

// For non-book specific general chat
const GENERAL_INTRO_PROMPTS = [
  "I'm here to help! What book-related questions can I answer for you today?",
  "Hello! I can chat about books, authors, or literary concepts. What's on your mind?",
  "I'm your AI reading companion. What would you like to know about literature or specific books?",
  "Welcome! I can discuss books, recommend reads, or explain literary concepts. How can I help?",
  "I'd be happy to chat about any book-related topics. What interests you today?",
];

// Get a random prompt
function getRandomPrompt(isBookSpecific = true) {
  const prompts = isBookSpecific ? INTRO_PROMPTS : GENERAL_INTRO_PROMPTS;
  return prompts[Math.floor(Math.random() * prompts.length)];
}

// Simple citation formatting
function formatCitations(text: string, book: string | null, author: string | null) {
  if (!book) return text;
  
  // Add a citation at the end
  return `${text}\n\n(From "${book}"${author ? ` by ${author}` : ''})`;
}

// Function to fetch chunks from the database
async function fetchBookChunks(supabase: any, bookId: string) {
  console.log(`Fetching chunks for book ID: ${bookId}`);
  
  const { data, error } = await supabase
    .from('book_chunks')
    .select('*')
    .eq('book_id', bookId)
    .order('chunk_index');
    
  if (error) {
    console.error('Error fetching book chunks:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return [];
  }
  
  console.log(`Found ${data?.length || 0} chunks for book ID: ${bookId}`);
  
  // Log first chunk details for debugging if available
  if (data && data.length > 0) {
    const firstChunk = data[0];
    console.log('First chunk sample:', {
      id: firstChunk.id,
      book_id: firstChunk.book_id,
      chunk_index: firstChunk.chunk_index,
      title: firstChunk.title,
      textLength: firstChunk.text?.length || 0,
      summaryLength: firstChunk.summary?.length || 0
    });
  } else {
    console.warn(`No chunks found for book ID: ${bookId}`);
  }
  
  return data || [];
}

// Function to fetch a book by ID
async function fetchBook(supabase: any, bookId: string) {
  console.log(`Fetching book with ID: ${bookId}`);
  
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', bookId)
    .single();
    
  if (error) {
    console.error('Error fetching book:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return null;
  }
  
  console.log('Found book:', {
    id: data?.id,
    title: data?.title,
    author: data?.author,
    status: data?.status,
    chunks_count: data?.chunks_count
  });
  
  return data;
}

// Function to search for a book by title
async function searchBookByTitle(supabase: any, title: string) {
  console.log(`Searching for book with title containing: "${title}"`);
  
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .ilike('title', `%${title}%`)
    .limit(1);
    
  if (error) {
    console.error('Error searching for book:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return null;
  }
  
  if (data && data.length > 0) {
    console.log('Found book:', {
      id: data[0].id,
      title: data[0].title,
      author: data[0].author,
      status: data[0].status,
      chunks_count: data[0].chunks_count
    });
    return data[0];
  }
  
  console.log('No book found matching title');
  return null;
}

// Simple simulation of an AI response based on chunks
function generateResponse(query: string, chunks: any[], book: string | null, author: string | null) {
  console.log(`Generating response for query: "${query}"`);
  console.log(`Using ${chunks.length} chunks for context`);
  
  // For testing purposes, use a simple algorithm
  // In a real implementation, we would use a proper LLM here
  
  if (chunks.length === 0) {
    if (book) {
      return {
        response: `I don't have enough information about "${book}" to answer your question about "${query}". You might want to try asking something else or uploading more content for this book.`,
        book,
        author
      };
    } else {
      return {
        response: `I don't have any specific information to answer your question about "${query}". Could you provide more context or ask about a specific book?`,
        book: null,
        author: null
      };
    }
  }
  
  // Extract text from chunks and join with newlines
  const chunkTexts = chunks.map(chunk => {
    // Sanitize any HTML content in chunks
    return sanitizeHtml(chunk.text || "");
  });
  
  // Simple heuristic: Find chunks that contain words from the query
  const queryWords = query.toLowerCase().split(/\W+/).filter(word => word.length > 3);
  
  if (queryWords.length === 0) {
    // If no significant words in query, return a generic response
    return {
      response: formatCitations(
        `I'd be happy to help with "${book || 'your question'}", but could you please be more specific about what you'd like to know?`,
        book,
        author
      ),
      book,
      author
    };
  }
  
  // Score chunks based on word matches
  const scoredChunks = chunkTexts.map((text, index) => {
    const lowerText = text.toLowerCase();
    const score = queryWords.reduce((sum, word) => {
      return sum + (lowerText.includes(word) ? 1 : 0);
    }, 0);
    return { text, score, index };
  });
  
  // Sort by score
  scoredChunks.sort((a, b) => b.score - a.score);
  
  // Use the highest scoring chunk as the main source
  const bestChunk = scoredChunks[0];
  
  if (bestChunk.score === 0) {
    // No relevant chunks found
    return {
      response: formatCitations(
        `I've looked through "${book || 'my knowledge base'}", but I don't have specific information about "${query}". Would you like to ask something else about this ${book ? 'book' : 'topic'}?`,
        book,
        author
      ),
      book,
      author
    };
  }
  
  // Extract sentences from the best chunk
  const sentences = bestChunk.text.split(/[.!?]+/).map(s => s.trim()).filter(s => s);
  
  // Select 2-3 most relevant sentences
  let responseSentences = [];
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    const matches = queryWords.some(word => lowerSentence.includes(word));
    if (matches) {
      responseSentences.push(sentence);
      if (responseSentences.length >= 3) break;
    }
  }
  
  // If we couldn't find relevant sentences, just take the first few
  if (responseSentences.length === 0) {
    responseSentences = sentences.slice(0, 3);
  }
  
  // Create a coherent response
  const directAnswer = responseSentences.join('. ');
  
  // Add an introduction
  const intro = `Based on "${book || 'the information available'}", `;
  
  // Final response
  return {
    response: formatCitations(
      `${intro}${directAnswer}.`,
      book,
      author
    ),
    book,
    author
  };
}

// Main function to process chat requests
serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client using auth from header
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
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
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Use provided chunks if available, otherwise fetch them
    let chunks = providedChunks ? providedChunks.map(chunk => {
      return {
        ...chunk,
        text: sanitizeHtml(chunk.text || "")
      };
    }) : [];
    
    let book = bookTitle;
    let author = null;
    let bookData = null;

    // If we have bookId but no chunks, fetch them from database
    if (bookId && chunks.length === 0) {
      console.log(`Using bookId ${bookId} to fetch chunks`);
      
      // First, get book details
      bookData = await fetchBook(supabaseClient, bookId);
      
      if (bookData) {
        book = bookData.title;
        author = bookData.author;
        
        // Then, get book chunks
        chunks = await fetchBookChunks(supabaseClient, bookId);
        console.log(`Fetched ${chunks.length} chunks for book "${book}" (ID: ${bookId})`);
        
        // If no chunks found but book exists
        if (chunks.length === 0) {
          console.log(`No chunks found for book ID: ${bookId} despite book existing in database`);
          console.log(`Book status: ${bookData.status}, chunks_count: ${bookData.chunks_count}`);
          
          // If book status indicates processing, inform the user
          if (bookData.status === 'processing' || bookData.status === 'extracting') {
            return new Response(
              JSON.stringify({
                response: `Your book "${book}" is still being processed. Please try again in a few moments.`,
                book,
                author,
                bookId,
                status: bookData.status
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
          
          // If book status is error or failed, inform the user
          if (bookData.status === 'error' || bookData.status === 'failed') {
            return new Response(
              JSON.stringify({
                response: `There was an issue processing your book "${book}". You may need to try uploading it again.`,
                book,
                author,
                bookId,
                status: bookData.status
              }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }
          
          // For other cases, return a generic error
          return new Response(
            JSON.stringify({
              response: `I found "${book}" in your library, but I couldn't retrieve any content for it. This might be a technical issue.`,
              book,
              author,
              bookId,
              error: "No chunks found for book"
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      } else {
        console.log(`No book found with ID: ${bookId}`);
        
        return new Response(
          JSON.stringify({
            response: `I couldn't find a book with the specified ID in your library. You may need to select a different book or upload it again.`,
            book: null,
            author: null,
            error: `Book not found with ID: ${bookId}`
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // If we have a book parameter but no book ID, try to find the book
    if (book && !bookId) {
      console.log('Book title provided without bookId');
      
      try {
        // Try to find the book by title
        const foundBookData = await searchBookByTitle(supabaseClient, book);
        
        if (foundBookData) {
          console.log('Found book by title:', foundBookData.title);
          
          // Return a response asking user to select this book directly
          return new Response(
            JSON.stringify({
              response: `I found "${foundBookData.title}" in your library. Please try asking your question again by selecting this book directly.`,
              book: foundBookData.title,
              author: foundBookData.author,
              foundBookId: foundBookData.id
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        
        // If we can't find the book, respond with a better message
        return new Response(
          JSON.stringify({
            response: `I don't see "${book}" in your library. You can upload this book or ask a general question without specifying a book.`,
            book: null,
            author: null
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (err) {
        console.error('Error processing book title:', err);
        console.error('Error stack:', err.stack);
        return new Response(
          JSON.stringify({
            response: `I couldn't process your query about "${book}". Please try selecting a book from your library directly.`,
            book: null,
            author: null,
            error: `Error processing book title: ${err.message}`
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Format context from chunks
    if (chunks.length > 0) {
      console.log(`Using ${chunks.length} chunks for context`);
      
      // Generate response using chunks
      const response = generateResponse(query, chunks, book, author);
      
      console.log('Generated response with content');
      return new Response(
        JSON.stringify({
          ...response,
          bookId: bookId,
          chunksCount: chunks.length
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } 
    // This is general chat, not specific to any book
    else if (!book && !bookId) {
      console.log('General chat (not book-specific)');
      
      // For general chat, we can use a template response
      let response = `I'm BookBodh, your AI assistant. ${query}`;
      
      // Add a more conversational response for specific query patterns
      if (query.toLowerCase().includes('book') || query.toLowerCase().includes('read')) {
        response = `As your AI book assistant, I can help with book recommendations, literary analysis, and reading insights. Regarding your question about "${query}" - is there a specific genre or author you're interested in?`;
      } else if (query.toLowerCase().includes('who are you') || query.toLowerCase().includes('what can you do')) {
        response = `I'm BookBodh, your AI reading companion. I can help you explore books, understand literary themes, find new reading recommendations, and chat about your favorite authors and genres. You can also upload books and I'll help you extract insights from them!`;
      } else if (query.toLowerCase().includes('hello') || query.toLowerCase().includes('hi')) {
        response = `Hello! I'm BookBodh, your friendly book AI assistant. I'm here to chat about books, authors, and literary topics. You can ask me about specific books in your library, or we can discuss general literary topics. How can I help you today?`;
      } else {
        // For any other general question
        response = `I'm BookBodh, your friendly assistant for exploring literary realms. ${getRandomPrompt(false)} For more specific insights, you might want to select a book from your library or upload a new one.`;
      }
      
      console.log('Generated general response');
      return new Response(
        JSON.stringify({
          response,
          book: null,
          author: null,
          bookId: null,
          chunksCount: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    // Book-specific, but no chunks found
    else {
      console.log(`No chunks found for book: "${book}"`);
      
      // Save chat history
      try {
        await supabaseClient
          .from('chat_history')
          .insert({
            query,
            response: `I'm sorry, I couldn't find any content for "${book}". Please try uploading the book or selecting a different one.`,
            book,
            author
          });
      } catch (error) {
        console.error('Error saving chat history:', error);
      }
      
      return new Response(
        JSON.stringify({
          response: `I couldn't find any content for "${book}". Please try uploading the book or selecting a different one.`,
          book,
          author: null,
          bookId: bookId,
          error: "No chunks found",
          chunksCount: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
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
