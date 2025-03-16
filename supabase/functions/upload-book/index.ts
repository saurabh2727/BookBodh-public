
// Follow this setup locally:
// 1. Run `npx supabase start` (after installing supabase-js SDK)
// 2. Run `npx supabase functions serve upload-book`

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import * as pdfjs from "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/+esm";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Create a Supabase client with Admin privileges for file operations
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Extract text from PDF using pdfjs
const extractTextFromPDF = async (fileBuffer: Uint8Array): Promise<string> => {
  console.log('Starting improved PDF text extraction');
  try {
    // Initialize PDF.js
    const loadingTask = pdfjs.getDocument({ data: fileBuffer });
    const pdf = await loadingTask.promise;
    console.log(`PDF loaded successfully with ${pdf.numPages} pages`);
    
    let fullText = '';
    
    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Combine text items into a single string with proper spacing
      const pageText = textContent.items
        .filter((item: any) => 'str' in item && typeof item.str === 'string')
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ');
      
      fullText += pageText + ' ';
      
      if (i % 10 === 0 || i === pdf.numPages) {
        console.log(`Processed ${i}/${pdf.numPages} pages`);
      }
    }
    
    // Clean up the text - remove PDF metadata markers and other unwanted patterns
    fullText = fullText
      .trim()
      .replace(/\s+/g, ' ')         // Normalize whitespace
      .replace(/(\w)-\s(\w)/g, '$1$2') // Remove hyphenation at line breaks
      .replace(/&#172;/g, '¬')      // Fix common character issues
      .replace(/&#163;/g, '£')
      .replace(/&#128;/g, '€')
      .replace(/\n{3,}/g, '\n\n')   // Normalize multiple newlines
      .replace(/%PDF[\s\S]*?obj/g, '') // Remove PDF metadata markers
      .replace(/<<\/[\s\S]*?>>/g, '') // Remove PDF object references
      .replace(/\d+ \d+ R/g, '')    // Remove PDF references
      .replace(/\[\s*\d+\s+\d+\s+\d+\s+\d+\s*\]/g, '') // Remove PDF coordinates
      .replace(/obj<.*?>/g, '')     // Remove remaining obj markers
      .replace(/endobj/g, '')       // Remove endobj markers
      .replace(/stream[\s\S]*?endstream/g, '') // Remove stream content
      .replace(/\d+\s+\d+\s+obj/g, ''); // Remove object definitions
    
    // If the text still contains too many PDF markers, try an alternative approach
    if (fullText.includes('%PDF') || fullText.includes('obj<<') || fullText.length < 1000) {
      console.log('Text still contains PDF markers, using alternative extraction method');
      fullText = '';
      
      // Alternative extraction focusing only on readable text sections
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Focus on text items that look like actual content
        const pageText = textContent.items
          .filter((item: any) => {
            return 'str' in item && 
                   typeof item.str === 'string' && 
                   item.str.length > 1 &&
                   !item.str.match(/%PDF|obj<|endobj|\d+ \d+ R/);
          })
          .map((item: any) => item.str)
          .join(' ');
        
        fullText += pageText + ' ';
      }
      
      fullText = fullText.trim().replace(/\s+/g, ' ');
    }
    
    // Final validation - if we still have PDF markers, just extract plain alphabetic content
    if (fullText.includes('%PDF') || fullText.length < 500) {
      console.log('Falling back to basic text extraction');
      // Extract only alphabetic content with spaces and basic punctuation
      fullText = fullText.replace(/[^a-zA-Z0-9\s\.,;:!?'"()-]/g, ' ').replace(/\s+/g, ' ').trim();
    }
    
    console.log(`Extracted ${fullText.length} characters of cleaned text`);
    
    if (fullText.length < 500) {
      console.warn('Warning: Extracted text is very short, PDF might not contain extractable text');
    }
    
    return fullText;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    return '';
  }
};

// Function to extract the first page of a PDF as an image
const extractFirstPageAsImage = async (fileBuffer: Uint8Array): Promise<Uint8Array | null> => {
  try {
    console.log('Extracting first page as image');
    // Initialize PDF.js
    const loadingTask = pdfjs.getDocument({ data: fileBuffer });
    const pdf = await loadingTask.promise;
    
    if (pdf.numPages === 0) {
      console.warn('PDF has no pages');
      return null;
    }
    
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 }); // Increase scale for better quality
    
    // Create a canvas to render the page
    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    
    if (!context) {
      console.warn('Could not get canvas context');
      return null;
    }
    
    // Set white background
    context.fillStyle = 'white';
    context.fillRect(0, 0, viewport.width, viewport.height);
    
    // Render PDF page to canvas
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    // Convert canvas to PNG
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const arrayBuffer = await blob.arrayBuffer();
    
    console.log('First page extracted as image successfully');
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error('Error extracting first page as image:', error);
    return null;
  }
};

// Function to chunk text by words with improved handling
const chunkText = (text: string, chunkSize = 500): string[] => {
  console.log(`Chunking text into segments of ~${chunkSize} words`);
  // Split by sentence boundaries when possible
  const sentences = text.replace(/([.!?])\s+/g, '$1|').split('|');
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (!sentence.trim()) continue;
    
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
  
  console.log(`Created ${chunks.length} chunks`);
  return chunks;
};

// Generate a human-readable summary for a chunk of text
const generateSummary = (text: string, maxWords = 50): string => {
  // Find the first few complete sentences if possible
  const sentencePattern = /^.+?[.!?](?:\s|$)/g;
  const sentences = text.match(sentencePattern) || [];
  
  let summary = '';
  let wordCount = 0;
  
  for (const sentence of sentences) {
    const sentenceWordCount = sentence.split(/\s+/).length;
    if (wordCount + sentenceWordCount <= maxWords) {
      summary += sentence;
      wordCount += sentenceWordCount;
    } else {
      break;
    }
  }
  
  // If we couldn't get enough complete sentences, just use the first maxWords
  if (wordCount < maxWords / 2) {
    const words = text.split(/\s+/);
    summary = words.slice(0, maxWords).join(' ') + (words.length > maxWords ? '...' : '');
  }
  
  return summary.trim();
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
    if (!file.filename || !file.filename.toLowerCase().endsWith('.pdf')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Only PDF files are allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a unique filename to prevent overwriting
    const uniqueFilename = `${user.id}-${Date.now()}-${file.name}`;
    const filePath = `${user.id}/${uniqueFilename}`;
    
    console.log(`Processing file: ${file.name} (${file.size} bytes)`);
    
    // Convert File to ArrayBuffer for upload and processing
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Upload the file to Supabase Storage
    console.log('Uploading file to storage...');
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('books')
      .upload(filePath, fileBuffer, {
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
      .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry

    // Extract the first page as an image and upload as book icon
    console.log('Extracting book cover...');
    const iconBuffer = await extractFirstPageAsImage(fileBuffer);
    let iconUrl = null;
    
    if (iconBuffer) {
      const iconFilename = `${user.id}-${Date.now()}-icon-${file.name.replace('.pdf', '.png')}`;
      const iconPath = `${user.id}/${iconFilename}`;
      
      const { data: iconUploadData, error: iconUploadError } = await supabaseClient.storage
        .from('books')
        .upload(iconPath, iconBuffer, {
          contentType: 'image/png',
          upsert: true,
        });
        
      if (!iconUploadError) {
        const { data: iconUrlData } = await supabaseClient.storage
          .from('books')
          .createSignedUrl(iconPath, 60 * 60 * 24 * 365); // 1 year expiry
          
        if (iconUrlData) {
          iconUrl = iconUrlData.signedUrl;
          console.log('Book cover uploaded successfully');
        }
      } else {
        console.warn('Failed to upload book cover:', iconUploadError);
      }
    } else {
      console.warn('Could not extract book cover');
    }
    
    // Extract text from PDF with improved method
    console.log('Extracting text from PDF...');
    const extractedText = await extractTextFromPDF(fileBuffer);
    
    if (!extractedText || extractedText.length < 100) {
      console.error('Failed to extract meaningful text from PDF');
      return new Response(
        JSON.stringify({ success: false, error: 'Could not extract readable text from the PDF' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate chunks with improved method
    console.log('Generating text chunks...');
    const textChunks = chunkText(extractedText);
    
    // Generate a summary for the whole book
    console.log('Generating book summary...');
    const wholeSummary = generateSummary(extractedText, 100);
    
    console.log('Book summary:', wholeSummary);
    
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
