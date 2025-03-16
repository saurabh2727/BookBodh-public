// Follow this setup locally:
// 1. Run `npx supabase start` (after installing supabase-js SDK)
// 2. Run `npx supabase functions serve upload-book`

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Create a Supabase client with Admin privileges for file operations
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Improved text extraction function
const extractTextFromPDF = (fileBuffer: Uint8Array): string => {
  // Simple extraction - in production, use a proper PDF parser
  const decoder = new TextDecoder('utf-8');
  let text = decoder.decode(fileBuffer);
  
  // Remove PDF header/metadata markers (like %PDF-1.x)
  text = text.replace(/%PDF-\d+\.\d+.*?(?=\n\n)/s, '');
  
  // Extract only readable text by:
  // 1. Remove binary data and non-printable ASCII characters
  text = text.replace(/[^\x20-\x7E\n\r\t]/g, '')
    .replace(/[\x00-\x1F\x7F-\xFF]/g, '');
    
  // 2. Remove PDF-specific commands and objects
  text = text.replace(/\/\w+\s+\d+\s+\d+\s+R/g, '')
             .replace(/\d+\s+\d+\s+obj.*?endobj/gs, '')
             .replace(/<<.*?>>/gs, '')
             .replace(/stream.*?endstream/gs, '');
             
  // 3. Clean up whitespace (multiple spaces, newlines)
  text = text.replace(/\s+/g, ' ')
             .replace(/\s+\./g, '.')
             .replace(/\s+,/g, ',')
             .trim();
             
  return text;
};

// Function to chunk text by words with improved handling
const chunkText = (text: string, chunkSize = 500): string[] => {
  // Split by sentence boundaries when possible
  const sentences = text.replace(/([.!?])\s+/g, '$1|').split('|');
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    // If adding this sentence would exceed chunk size, save current chunk and start new one
    if (currentChunk.split(/\s+/).length + sentence.split(/\s+/).length > chunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    
    currentChunk += (currentChunk ? ' ' : '') + sentence;
    
    // If current chunk is getting too large, save it even without a sentence boundary
    if (currentChunk.split(/\s+/).length >= chunkSize) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
  }
  
  // Add the last chunk if there's anything left
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
};

// Generate a summary for a chunk of text
const generateSummary = (text: string, maxWords = 50): string => {
  // Find the first complete sentence if possible
  const sentenceMatch = text.match(/^.*?[.!?]\s/);
  if (sentenceMatch && sentenceMatch[0].split(/\s+/).length <= maxWords) {
    return sentenceMatch[0].trim();
  }
  
  // Otherwise, use the first maxWords words
  const words = text.split(/\s+/);
  return words.slice(0, maxWords).join(' ') + (words.length > maxWords ? '...' : '');
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a Supabase client with the user's JWT
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is a multipart form data request
    const contentType = req.headers.get('content-type') || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Expected multipart/form-data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the form data
    const formData = await req.formData();
    const file = formData.get('file');
    const title = formData.get('title') as string || 'Untitled';
    const author = formData.get('author') as string || 'Unknown';
    const category = formData.get('category') as string || 'Uncategorized';
    
    // Validate category
    const validCategories = ["Fiction", "Non-Fiction", "Philosophy", "Science", "History"];
    if (!validCategories.includes(category)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid category. Must be one of: ${validCategories.join(', ')}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!file || !(file instanceof File)) {
      return new Response(
        JSON.stringify({ success: false, error: 'No file found in request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type (PDF only)
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Only PDF files are allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a unique filename
    const uniqueFilename = `${user.id}-${Date.now()}-${file.name}`;
    
    // Convert File to ArrayBuffer for upload and processing
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Upload the file to Supabase Storage
    console.log('Uploading file to storage...');
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('books')
      .upload(`${user.id}/${uniqueFilename}`, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return new Response(
        JSON.stringify({ success: false, error: `Error uploading file: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate URL for the uploaded file
    const { data: urlData } = await supabaseClient.storage
      .from('books')
      .createSignedUrl(`${user.id}/${uniqueFilename}`, 60 * 60 * 24 * 365); // 1 year expiry

    // Create a placeholder icon URL (first page image)
    // In production, you would extract the first page as an image
    const iconFilename = `${user.id}-${Date.now()}-icon-${file.name}.png`;
    const iconUrl = null; // For now, we leave this as null; in production, extract and upload first page
    
    // Extract text from PDF with improved method
    console.log('Extracting text from PDF...');
    const extractedText = extractTextFromPDF(fileBuffer);
    
    // Generate chunks with improved method
    console.log('Generating text chunks...');
    const textChunks = chunkText(extractedText);
    
    // Generate a summary for the whole book
    console.log('Generating book summary...');
    const wholeSummary = generateSummary(extractedText, 100);
    
    // Insert book data into the database
    console.log('Inserting book data into database...');
    const { data: bookData, error: bookError } = await supabaseClient
      .from('books')
      .insert({
        user_id: user.id,
        title,
        author,
        category,
        file_url: urlData?.signedUrl || '',
        icon_url: iconUrl,
        summary: wholeSummary,
      })
      .select()
      .single();
      
    if (bookError) {
      console.error('Error inserting book:', bookError);
      return new Response(
        JSON.stringify({ success: false, error: `Error saving book metadata: ${bookError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Insert text chunks with summaries
    console.log('Inserting text chunks...');
    const chunkInserts = textChunks.map((chunk, index) => {
      const chunkSummary = generateSummary(chunk, 50);
      return {
        book_id: bookData.id,
        chunk_index: index,
        title: `${title} - Part ${index + 1}`,
        text: chunk,
        summary: chunkSummary
      };
    });
    
    if (chunkInserts.length > 0) {
      const { error: chunksError } = await supabaseClient
        .from('book_chunks')
        .insert(chunkInserts);
        
      if (chunksError) {
        console.error('Error inserting chunks:', chunksError);
        // We don't fail the whole operation if chunks fail, but log it
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Book '${title}' by ${author} uploaded successfully`,
        bookId: bookData.id,
        fileUrl: urlData?.signedUrl || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing upload:', error);
    return new Response(
      JSON.stringify({ success: false, error: `Server error: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
