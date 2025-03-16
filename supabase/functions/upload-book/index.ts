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

// Simple text extraction function (simulated for now)
// In a production environment, you would use a more robust PDF parsing library
const extractTextFromPDF = (fileBuffer: Uint8Array): string => {
  // Simple extraction - in production, use a proper PDF parser
  // This is a placeholder that extracts readable text
  const decoder = new TextDecoder('utf-8');
  const text = decoder.decode(fileBuffer);
  
  // Extract text-like content (very simplified)
  // Remove binary data and keep only printable ASCII characters
  return text.replace(/[^\x20-\x7E\n\r\t]/g, '')
    .replace(/[\x00-\x1F\x7F-\xFF]/g, '')
    .trim();
};

// Function to chunk text by words
const chunkText = (text: string, chunkSize = 500): string[] => {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunkWords = words.slice(i, i + chunkSize);
    if (chunkWords.length > 0) {
      chunks.push(chunkWords.join(' '));
    }
  }
  
  return chunks;
};

// Generate a simple summary (placeholder)
const generateSummary = (text: string): string => {
  // In production, you would use an AI service for summarization
  // This is a simplified placeholder
  const words = text.split(/\s+/);
  const firstFewWords = words.slice(0, 100).join(' ');
  return `${firstFewWords}...`;
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
    
    // Ensure the books bucket exists (create it if it doesn't)
    const { data: buckets } = await adminClient.storage.listBuckets();
    const booksBucketExists = buckets?.some(bucket => bucket.name === 'books');
    
    if (!booksBucketExists) {
      await adminClient.storage.createBucket('books', {
        public: false, // Keep files private
      });
      
      // Set up RLS policy to allow authenticated users to access their own files
      await adminClient.storage.from('books').createPolicy('books_policy', {
        name: 'Only the owner can access their files',
        definition: "((storage.foldername(name))[1] = auth.uid())",
        allow: 'insert,update,select,delete',
        identities: ['authenticated'],
      });
    }
    
    // Convert File to ArrayBuffer for upload and processing
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Upload the file to Supabase Storage
    const { data: uploadData, error: uploadError } = await adminClient.storage
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
    const { data: urlData } = await adminClient.storage
      .from('books')
      .createSignedUrl(`${user.id}/${uniqueFilename}`, 60 * 60 * 24 * 365); // 1 year expiry

    // Create a placeholder icon URL (first page image)
    // In production, you would extract the first page as an image
    const iconFilename = `${user.id}-${Date.now()}-icon-${file.name}.png`;
    const iconUrl = null; // For now, we leave this as null; in production, extract and upload first page
    
    // Extract text from PDF
    console.log('Extracting text from PDF...');
    const extractedText = extractTextFromPDF(fileBuffer);
    
    // Generate chunks
    console.log('Generating text chunks...');
    const textChunks = chunkText(extractedText);
    
    // Generate a summary
    console.log('Generating summary...');
    const summary = generateSummary(extractedText);
    
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
        summary,
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
    
    // Insert text chunks
    console.log('Inserting text chunks...');
    const chunkInserts = textChunks.map((chunk, index) => ({
      book_id: bookData.id,
      chunk_index: index,
      title: `${title} - Part ${index + 1}`,
      text: chunk
    }));
    
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
