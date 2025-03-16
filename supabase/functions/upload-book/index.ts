
// supabase/functions/upload-book/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { v4 as uuidv4 } from 'https://esm.sh/uuid@9';

// The maximum file size allowed (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;  // 50MB in bytes

// Function to extract text from PDF and create chunks
async function processBookText(text: string, title: string, chunkSize = 500) {
  // Split text into words and then groups of words (chunks)
  const words = text.split(/\s+/);
  const chunks = [];
  
  let currentChunk = [];
  let wordCount = 0;
  
  for (const word of words) {
    if (word.trim().length === 0) continue; // Skip empty words
    
    currentChunk.push(word);
    wordCount++;
    
    if (wordCount >= chunkSize) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
      wordCount = 0;
    }
  }
  
  // Add the last chunk if there are remaining words
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }
  
  // Format chunks with metadata and create summaries
  return chunks.map((chunkText, index) => {
    // Create a simple summary by taking the first few sentences or characters
    const sentences = chunkText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const summaryText = sentences.slice(0, 2).join('. ') + (sentences.length > 2 ? '...' : '');
    
    return {
      chunk_index: index,
      title: `${title} - Part ${index + 1}`,
      text: chunkText,
      summary: summaryText.length > 10 ? summaryText : `Part ${index + 1} of ${title}`
    };
  });
}

// Improved function to extract text from PDF bytes
async function extractTextFromPDF(buffer: ArrayBuffer) {
  console.log("Extracting text from PDF buffer of size: ", buffer.byteLength);
  
  const decoder = new TextDecoder('utf-8');
  const bytes = new Uint8Array(buffer);
  let text = "";
  
  // Try multiple PDF text extraction methods
  
  // Method 1: Look for text streams
  console.log("Trying extraction method 1: Text streams");
  const pdfString = decoder.decode(bytes);
  
  // Look for text objects with TJ or Tj operators
  const textMatches = pdfString.match(/\[((?:[^\]\\]|\\.)*)\]\s*TJ|\(((?:[^)\\]|\\.)*)\)\s*Tj/g) || [];
  for (const match of textMatches) {
    // Clean up text by removing PDF encoding
    let cleanText = match
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\')
      .replace(/\\n/g, ' ')
      .replace(/\\r/g, ' ');
      
    // Remove brackets, TJ, Tj operators
    cleanText = cleanText.replace(/\[(.*)\]\s*TJ|\((.*)\)\s*Tj/g, '$1$2');
    
    if (cleanText.trim().length > 0) {
      text += cleanText + " ";
    }
  }
  
  // Method 2: Try to extract text between BT and ET markers
  if (text.trim().length < 200) {
    console.log("Trying extraction method 2: BT/ET blocks");
    const btEtMatches = pdfString.match(/BT[\s\S]+?ET/g) || [];
    for (const match of btEtMatches) {
      // Extract text content from BT/ET blocks
      const contentMatch = match.match(/\[((?:[^\]\\]|\\.)*)\]|(\((?:[^)\\]|\\.)*\))/g) || [];
      for (const cm of contentMatch) {
        let cleanText = cm.replace(/^\[|\]$|\(|\)$/g, '');
        if (cleanText.trim().length > 0) {
          text += cleanText + " ";
        }
      }
    }
  }
  
  // Method 3: Look for plain text content
  if (text.trim().length < 200) {
    console.log("Trying extraction method 3: Plain text");
    // Find PDF object streams that might contain text
    const streamMatches = pdfString.match(/stream\r?\n([\s\S]*?)\r?\nendstream/g) || [];
    for (const match of streamMatches) {
      const streamContent = match.replace(/stream\r?\n|\r?\nendstream/g, '');
      // Extract what looks like text
      const textContent = streamContent.replace(/[^\x20-\x7E\t\r\n]/g, ' ').trim();
      if (textContent.length > 50) {
        text += textContent + " ";
      }
    }
  }
  
  // Cleanup the extracted text
  text = text.replace(/\\u[0-9a-fA-F]{4}/g, '') // Remove Unicode escape sequences
             .replace(/\s+/g, ' ')              // Normalize whitespace
             .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '') // Remove control chars
             .trim();
  
  console.log(`Extracted ${text.length} characters of text`);
  
  // If we still didn't get much text, return placeholder text for testing
  if (text.trim().length < 100) {
    console.log("Warning: Could not extract sufficient text from PDF. Using placeholder text.");
    text = `This is placeholder text for ${new Date().toISOString()}. The PDF extraction was not successful. This PDF may be scanned, encrypted, or using non-standard formatting that makes text extraction difficult.`;
  }
  
  return text;
}

Deno.serve(async (req) => {
  console.log("Upload book function called");
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight request");
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log("Starting book upload process");
    
    // Create Supabase client
    const authHeader = req.headers.get('Authorization');
    console.log("Auth header exists:", authHeader !== null);
    console.log("Auth header length:", authHeader?.length || 0);
    
    if (!authHeader) {
      console.error("Missing Authorization header");
      return new Response(
        JSON.stringify({ success: false, message: 'No authorization header provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Create the Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: authHeader } },
      }
    );
    
    console.log("Supabase client created");

    // Get the user from the session
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error("Authentication error:", userError || "No user found");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: userError ? `Authentication error: ${userError.message}` : 'User not authenticated' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log("User authenticated:", user.id);

    // Make sure the request is multipart/form-data
    const contentType = req.headers.get('content-type') || '';
    console.log("Content-Type:", contentType);
    
    if (!contentType.includes('multipart/form-data')) {
      console.error("Invalid content type:", contentType);
      return new Response(
        JSON.stringify({ success: false, message: 'Request must be multipart/form-data' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log("Valid content type");

    try {
      // Try to parse the form data
      const formData = await req.formData();
      console.log("Form data parsed successfully");
      
      // Extract fields from form data
      const file = formData.get('file') as File;
      const title = formData.get('title') as string;
      const author = formData.get('author') as string;
      const category = formData.get('category') as string;
      
      console.log("Form data extracted:", {
        fileExists: !!file,
        fileType: file?.type,
        fileSize: file?.size,
        title,
        author,
        category
      });

      // Validate the file and metadata
      if (!file) {
        console.error("No file provided");
        return new Response(
          JSON.stringify({ success: false, message: 'No file provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (!title || !author || !category) {
        console.error("Missing required metadata", { title, author, category });
        return new Response(
          JSON.stringify({ success: false, message: 'Title, author, and category are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Check if file is a PDF
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        console.error("File is not a PDF");
        return new Response(
          JSON.stringify({ success: false, message: 'Only PDF files are allowed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        console.error("File too large:", file.size);
        return new Response(
          JSON.stringify({ success: false, message: `File size exceeds maximum allowed (50MB)` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log("File validation passed");
      
      // Generate a unique book ID
      const bookId = uuidv4();
      console.log("Generated book ID:", bookId);
      
      // Process the file
      try {
        console.log("Processing file...");
        
        // Convert file to ArrayBuffer for processing
        const buffer = await file.arrayBuffer();
        console.log("File converted to ArrayBuffer, size:", buffer.byteLength);
        
        // Check if it's a valid PDF by looking at the header
        const firstBytes = new Uint8Array(buffer.slice(0, 5));
        const header = new TextDecoder().decode(firstBytes);
        console.log("File header:", header);
        
        if (!header.startsWith('%PDF-')) {
          console.error("Invalid PDF header:", header);
          return new Response(
            JSON.stringify({ success: false, message: 'Invalid PDF file' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log("Valid PDF header detected");
        
        // Extract text from PDF using improved function
        console.log("Extracting text from PDF...");
        const extractedText = await extractTextFromPDF(buffer);
        console.log(`Extracted ${extractedText.length} characters of text`);
        
        // Create a summary from the extracted text
        let summary = '';
        try {
          summary = extractedText.length > 1000 
            ? extractedText.substring(0, 1000).replace(/\s+/g, ' ').trim() + '...'
            : extractedText.replace(/\s+/g, ' ').trim();
            
          // Clean summary to remove any problematic characters
          summary = summary.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
        } catch (summaryError) {
          console.error("Error creating summary:", summaryError);
          summary = `Summary of ${title} by ${author}. This is a book about various concepts and ideas in the category of ${category}.`;
        }
        
        console.log("Created summary for book, length:", summary.length);
        
        // Store book metadata in the database
        const { data: bookData, error: bookError } = await supabaseClient
          .from('books')
          .insert([
            {
              id: bookId,
              user_id: user.id,
              title,
              author,
              category,
              summary,
              file_url: `books/${bookId}.pdf`, // Placeholder URL
              status: 'processing'
            }
          ])
          .select();
          
        if (bookError) {
          console.error("Error inserting book into database:", bookError);
          return new Response(
            JSON.stringify({ success: false, message: `Database error: ${bookError.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log("Book metadata inserted into database:", bookData);
        
        // Process text into chunks
        console.log("Processing book text into chunks...");
        const chunks = await processBookText(extractedText, title);
        console.log(`Created ${chunks.length} chunks from book text`);
        
        // Use EdgeRuntime.waitUntil to process chunks in the background
        EdgeRuntime.waitUntil((async () => {
          console.log("Starting background chunk processing");
          let successCount = 0;
          let errorCount = 0;
          
          try {
            // Insert chunks into database
            if (chunks.length > 0) {
              // Capture insert results for each chunk
              for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                
                // Clean chunk text of control characters
                const cleanedText = chunk.text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
                const cleanedSummary = chunk.summary.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
                
                const { error: chunkError } = await supabaseClient
                  .from('book_chunks')
                  .insert([{
                    book_id: bookId,
                    chunk_index: chunk.chunk_index,
                    title: chunk.title,
                    text: cleanedText,
                    summary: cleanedSummary
                  }]);
                  
                if (chunkError) {
                  console.error(`Error inserting chunk ${i}:`, chunkError);
                  console.error("Error details:", JSON.stringify(chunkError, null, 2));
                  errorCount++;
                } else {
                  successCount++;
                }
                
                // Add a short delay between inserts to avoid overwhelming the database
                if (i % 5 === 0 && i > 0) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
              }
            }
            
            // Update book status based on chunk processing results
            const finalStatus = errorCount === 0 ? 'processed' : 
                               (successCount > 0 ? 'partially_processed' : 'failed');
                               
            const { error: updateError } = await supabaseClient
              .from('books')
              .update({ 
                status: finalStatus,
                chunks_count: successCount,
                failed_chunks: errorCount
              })
              .eq('id', bookId);
              
            if (updateError) {
              console.error("Error updating book status:", updateError);
            } else {
              console.log(`Book processing completed with status: ${finalStatus}`);
              console.log(`Successfully processed ${successCount} chunks with ${errorCount} failures`);
            }
          } catch (error) {
            console.error("Background processing error:", error);
            // Try to update book status on error
            try {
              await supabaseClient
                .from('books')
                .update({ 
                  status: 'error',
                  chunks_count: successCount,
                  failed_chunks: errorCount
                })
                .eq('id', bookId);
            } catch (updateError) {
              console.error("Failed to update book status after error:", updateError);
            }
          }
        })());
        
        // Return success response while processing continues in the background
        console.log("Upload completed successfully, background processing started");
        return new Response(
          JSON.stringify({
            success: true,
            message: `Book "${title}" uploaded successfully`,
            bookId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (processingError) {
        console.error("Error processing file:", processingError);
        console.error("Error details:", JSON.stringify(processingError, null, 2));
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Error processing file: ${processingError.message || "Unknown processing error"}` 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (formDataError) {
      console.error("Error parsing form data:", formDataError);
      return new Response(
        JSON.stringify({ success: false, message: `Error parsing form data: ${formDataError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error("Unexpected error in upload-book function:", error);
    console.error("Error stack:", error.stack);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: `Server error: ${error.message || "Unknown server error"}` 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
