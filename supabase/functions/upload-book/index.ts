
// Follow the steps below to run locally:
// 1. deno install -Arf -n supabase https://deno.land/x/supabase/cli/bin/supabase.ts
// 2. supabase functions serve upload-book --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { v4 as uuidv4 } from 'https://esm.sh/uuid@9';
import { corsHeaders } from '../_shared/cors.ts';
import * as pdfjs from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.269/build/pdf.min.mjs';

// Support for browsers to run the PDF.js properly
// @ts-ignore: Required for PDF.js to work
globalThis.XMLHttpRequest = XMLHttpRequest;
globalThis.DOMParser = DOMParser;

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.269/build/pdf.worker.min.mjs';

// Service role key needed for storage operations
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');

if (!serviceRoleKey || !supabaseUrl) {
  console.error('Missing Supabase environment variables');
}

// Constants for the chunking process
const CHUNK_SIZE = 2000; // Characters per chunk
const CHUNK_OVERLAP = 200; // Overlap between chunks to maintain context

// Main function to chunk the text
const chunkText = (text: string): string[] => {
  if (!text || text.length === 0) {
    console.warn('Cannot chunk empty text');
    return [];
  }
  
  // Clean the text by removing excessive newlines and spaces
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  
  const chunks: string[] = [];
  let i = 0;
  
  while (i < text.length) {
    // Get the chunk with potential overlap
    let chunkEnd = Math.min(i + CHUNK_SIZE, text.length);
    
    // Try to find a good breaking point (end of sentence)
    if (chunkEnd < text.length) {
      // Look for sentence boundaries (., !, ?) followed by space or newline
      const match = text.substring(chunkEnd - 50, chunkEnd + 50).match(/[.!?]\s+/);
      if (match && match.index !== undefined) {
        // Adjust chunkEnd to end at a sentence boundary
        chunkEnd = chunkEnd - 50 + match.index + 1;
      }
    }
    
    // Add the chunk to our array
    chunks.push(text.substring(i, chunkEnd).trim());
    
    // Move to the next chunk, accounting for overlap
    i = chunkEnd - CHUNK_OVERLAP;
    
    // Ensure we're making progress
    if (i <= 0) {
      console.error('Chunking algorithm error: no progress being made');
      break;
    }
  }
  
  return chunks;
};

// Process a PDF file and extract its text
const extractPdfText = async (fileBuffer: Uint8Array): Promise<string> => {
  console.log('Extracting text from PDF, buffer size:', fileBuffer.length);
  
  try {
    console.time('PDF loading time');
    const pdf = await pdfjs.getDocument({ data: fileBuffer }).promise;
    console.timeEnd('PDF loading time');
    
    console.log(`PDF loaded successfully. Pages: ${pdf.numPages}`);
    
    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 100); // Limit to first 100 pages
    
    // Extract text from each page
    console.time('Text extraction time');
    for (let i = 1; i <= maxPages; i++) {
      try {
        console.log(`Processing page ${i} of ${maxPages}...`);
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        
        // Join text items, preserving newlines
        const pageText = content.items
          .map((item: any) => 'str' in item ? item.str : '')
          .join(' ')
          .replace(/\s+/g, ' ') // Clean up multiple spaces
          .trim();
        
        fullText += pageText + '\n\n';
      } catch (pageError) {
        console.error(`Error extracting text from page ${i}:`, pageError);
      }
    }
    console.timeEnd('Text extraction time');
    
    // Clean up the text
    fullText = fullText
      .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
      .replace(/\s{2,}/g, ' ')    // Normalize multiple spaces
      .trim();
    
    // Debug: Check extracted text quality
    console.log(`Extracted text length: ${fullText.length} characters`);
    console.log('First 200 characters:', fullText.substring(0, 200));
    
    // Check for PDF metadata in the extracted text
    const containsPDFMetadata = fullText.includes('%PDF') || 
                                fullText.includes('obj<') || 
                                fullText.toLowerCase().includes('pdf-');
    
    if (containsPDFMetadata) {
      console.warn('Warning: Extracted text contains PDF metadata/markers, may not be properly parsed');
    }
    
    if (fullText.length < 500) {
      console.warn('Warning: Extracted text is very short, PDF might not contain extractable text');
      // Provide a fallback message for non-extractable PDFs
      return "This PDF does not contain easily extractable text. It might be scanned or image-based.";
    }
    
    return fullText;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    return 'Error extracting text from PDF. The file may be corrupt or password-protected.';
  }
};

// Generate a summary of the book
const generateSummary = async (text: string): Promise<string> => {
  // For now, just take the first 1000 characters as a summary
  // This could be replaced with a more sophisticated algorithm or AI model
  if (!text || text.length === 0) {
    return 'No text content available for summarization.';
  }
  
  // Clean the text to ensure we're not returning PDF metadata
  const cleanText = text
    .replace(/%PDF[^]*?obj/g, '') // Remove PDF header and objects
    .replace(/<<\/[^>]*>>/g, '')  // Remove PDF dictionary objects
    .trim();
  
  if (cleanText.length < 100) {
    return 'This document appears to contain limited extractable text content.';
  }
  
  // Get the first paragraph that has substantive content
  const paragraphs = cleanText.split('\n\n');
  let summary = '';
  
  for (const paragraph of paragraphs) {
    if (paragraph.length > 150 && !paragraph.includes('%PDF') && !paragraph.includes('obj<')) {
      summary = paragraph;
      break;
    }
  }
  
  // If we didn't find a good paragraph, just take the beginning
  if (!summary) {
    summary = cleanText.substring(0, 1000);
  }
  
  // Truncate and add ellipsis
  if (summary.length > 1000) {
    summary = summary.substring(0, 997) + '...';
  }
  
  return summary;
};

// Handler for the function
Deno.serve(async (req) => {
  console.log('--- Book Upload Request Started ---');
  console.log('Request method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // Create a Supabase client with the service role key
  const supabaseClient = createClient(
    supabaseUrl!,
    serviceRoleKey!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  try {
    // Get the user from the request
    console.log('Authenticating user...');
    const authHeader = req.headers.get('Authorization') || '';
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Invalid authorization header:', authHeader);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: userError?.message || 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('User authenticated:', user.id);

    // Ensure book storage bucket exists
    console.log('Checking if books bucket exists...');
    const { data: buckets } = await supabaseClient.storage.listBuckets();
    
    if (!buckets?.find(b => b.name === 'books')) {
      console.log('Creating books bucket...');
      await supabaseClient.storage.createBucket('books', {
        public: false,
        fileSizeLimit: 52428800 // 50MB
      });
    }

    // Parse form data to get file, title, and author
    console.log('Parsing form data...');
    const formData = await req.formData();
    
    const file = formData.get('file') as File;
    const title = formData.get('title') as string; 
    const author = formData.get('author') as string;
    const category = formData.get('category') as string;

    // Log received data for debugging
    console.log({
      fileReceived: !!file,
      fileType: file?.type,
      fileName: file?.name,
      fileSize: file?.size,
      title,
      author,
      category
    });

    // Validate required fields
    if (!file || !title || !author || !category) {
      console.error('Missing required fields:', { file: !!file, title, author, category });
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type (PDF only)
    const fileName = file.name || '';
    const fileType = file.type || '';
    
    console.log(`File details: name=${fileName}, type=${fileType}, size=${file.size}`);
    
    const isPDF = fileName.toLowerCase().endsWith('.pdf') || fileType === 'application/pdf';
    if (!isPDF) {
      console.error('Invalid file type:', fileType);
      return new Response(
        JSON.stringify({ success: false, error: 'Only PDF files are allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a unique filename to prevent overwriting
    const uniqueFilename = `${user.id}-${Date.now()}-${file.name}`;
    const filePath = `${user.id}/${uniqueFilename}`;
    
    // Convert File to ArrayBuffer for upload and processing
    console.log('Converting file to buffer...');
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Debug: Check first few bytes of the file
    const firstBytes = Array.from(fileBuffer.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log('First 16 bytes of file:', firstBytes);

    // Check if file starts with %PDF (basic PDF validation)
    const headerCheck = new TextDecoder().decode(fileBuffer.slice(0, 8));
    console.log('File header:', headerCheck);
    
    if (!headerCheck.startsWith('%PDF')) {
      console.error('Invalid PDF header:', headerCheck);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid PDF file format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upload the file to Supabase Storage
    console.log('Uploading file to storage...');
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('books')
      .upload(filePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(
        JSON.stringify({ success: false, error: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('File uploaded successfully:', uploadData.path);

    // Create a signed URL for the file
    const { data: urlData } = await supabaseClient.storage
      .from('books')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry

    if (!urlData?.signedUrl) {
      console.error('Failed to create signed URL');
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to create file URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract text from the PDF
    console.log('Extracting text from PDF...');
    const bookText = await extractPdfText(fileBuffer);
    
    if (!bookText || bookText.length < 100) {
      console.warn('Failed to extract sufficient text from PDF');
    }

    // Generate a summary of the book
    console.log('Generating book summary...');
    const summary = await generateSummary(bookText);
    console.log('Summary generated:', summary.substring(0, 100) + '...');

    // Split the text into chunks for vector storage
    console.log('Chunking text...');
    const chunks = chunkText(bookText);
    console.log(`Created ${chunks.length} chunks`);

    // Create a book entry in the database
    console.log('Creating book record...');
    const bookId = uuidv4();
    const { error: bookError } = await supabaseClient
      .from('books')
      .insert({
        id: bookId,
        user_id: user.id,
        title: title,
        author: author,
        category: category,
        file_url: urlData.signedUrl,
        summary: summary
      });

    if (bookError) {
      console.error('Book creation error:', bookError);
      return new Response(
        JSON.stringify({ success: false, error: bookError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create book chunks for vector search
    console.log('Storing book chunks...');
    const chunkPromises = chunks.map((chunk, i) => {
      return supabaseClient
        .from('book_chunks')
        .insert({
          book_id: bookId,
          chunk_index: i,
          title: title,
          text: chunk,
          summary: i === 0 ? summary : undefined
        });
    });
    
    const chunkResults = await Promise.allSettled(chunkPromises);
    const failedChunks = chunkResults.filter(r => r.status === 'rejected');
    
    if (failedChunks.length > 0) {
      console.warn(`${failedChunks.length} chunks failed to insert`);
    }

    console.log('Book processing complete!');
    console.log('--- Book Upload Request Completed Successfully ---');
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Book uploaded and processed successfully',
        bookId,
        fileUrl: urlData.signedUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing book upload:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error processing book upload' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
