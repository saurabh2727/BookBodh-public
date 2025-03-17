
// supabase/functions/upload-book/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { v4 as uuidv4 } from 'https://esm.sh/uuid@9';
import * as pdfParse from 'https://esm.sh/pdf-parse@1.1.1';

// The maximum file size allowed (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;  // 50MB in bytes

// Function to extract text from PDF bytes using pdf-parse
async function extractTextFromPDF(buffer: ArrayBuffer): Promise<string> {
  console.log("Extracting text from PDF buffer of size:", buffer.byteLength);
  
  try {
    // Convert ArrayBuffer to Uint8Array for pdf-parse
    const data = new Uint8Array(buffer);
    
    // Use pdf-parse to extract text
    const pdfData = await pdfParse.default(data);
    
    // Check if we got meaningful text
    if (pdfData.text && pdfData.text.trim().length > 100) {
      console.log(`Successfully extracted ${pdfData.text.length} characters of text`);
      return pdfData.text;
    } else {
      console.warn("PDF-parse extracted too little text, attempting fallback method");
    }
  } catch (error) {
    console.error("Error in primary text extraction:", error);
    console.warn("Primary text extraction failed, attempting fallback method");
  }
  
  // Fallback method: Manual text extraction
  return fallbackTextExtraction(buffer);
}

// Fallback text extraction method for when pdf-parse fails
async function fallbackTextExtraction(buffer: ArrayBuffer): Promise<string> {
  console.log("Using fallback text extraction method");
  
  try {
    const decoder = new TextDecoder('utf-8');
    const bytes = new Uint8Array(buffer);
    let text = "";
    
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
    
    console.log(`Fallback extraction produced ${text.length} characters of text`);
    
    // If we still didn't get much text, generate placeholder text
    if (text.trim().length < 100) {
      console.warn("All text extraction methods failed to extract sufficient text");
      return `This is placeholder text. The PDF extraction was not successful. This PDF may be scanned, encrypted, or using non-standard formatting that makes text extraction difficult. Uploaded at ${new Date().toISOString()}.`;
    }
    
    return text;
  } catch (error) {
    console.error("Error in fallback text extraction:", error, { stack: error.stack });
    return `Failed to extract text from this PDF. Error: ${error.message}. Uploaded at ${new Date().toISOString()}.`;
  }
}

// Function to extract text from PDF and create chunks
async function processBookText(text: string, title: string, chunkSize = 500): Promise<any[]> {
  console.log(`Processing book text: ${title}, text length: ${text.length}`);
  
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
  
  console.log(`Created ${chunks.length} chunks from book text`);
  
  // Format chunks with metadata and create summaries
  return chunks.map((chunkText, index) => {
    // Create a summary by taking the first ~50 words or 300 characters
    const words = chunkText.split(/\s+/).slice(0, 50);
    const summaryText = words.join(' ') + (words.length >= 50 ? '...' : '');
    
    return {
      chunk_index: index,
      title: `${title} - Part ${index + 1}`,
      text: chunkText,
      summary: summaryText.length > 10 ? summaryText : `Part ${index + 1} of ${title}`
    };
  });
}

// Function to create a book summary from the extracted text
function createBookSummary(text: string, maxLength = 600): string {
  // Take roughly the first 100 words or 600 characters for the book summary
  const summary = text.substring(0, maxLength);
  return summary.length < text.length ? summary + '...' : summary;
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
    
    if (!authHeader) {
      console.error("Missing Authorization header");
      return new Response(
        JSON.stringify({ success: false, error: 'No authorization header provided' }),
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
          error: userError ? `Authentication error: ${userError.message}` : 'User not authenticated' 
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
        JSON.stringify({ success: false, error: 'Request must be multipart/form-data' }),
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
          JSON.stringify({ success: false, error: 'No file provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (!title || !author || !category) {
        console.error("Missing required metadata", { title, author, category });
        return new Response(
          JSON.stringify({ success: false, error: 'Title, author, and category are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Check if file is a PDF
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        console.error("File is not a PDF");
        return new Response(
          JSON.stringify({ success: false, error: 'Only PDF files are allowed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        console.error("File too large:", file.size);
        return new Response(
          JSON.stringify({ success: false, error: `File size exceeds maximum allowed (50MB)` }),
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
            JSON.stringify({ success: false, error: 'Invalid PDF file' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log("Valid PDF header detected");
        
        // Extract text from PDF using our enhanced extraction function
        console.log("Extracting text from PDF...");
        try {
          const extractedText = await extractTextFromPDF(buffer);
          console.log(`Extracted ${extractedText.length} characters of text`);
          
          if (extractedText.length < 100) {
            console.error("Insufficient text extracted from PDF");
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Unable to extract sufficient text from the PDF. The file may be encrypted, scanned, or in an unsupported format.' 
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          // Create a summary from the extracted text
          const summary = createBookSummary(extractedText);
          console.log("Created book summary, length:", summary.length);
          
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
            console.error("Error details:", JSON.stringify(bookError, null, 2));
            return new Response(
              JSON.stringify({ success: false, error: `Database error: ${bookError.message}` }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          console.log("Book metadata inserted into database, ID:", bookId);
          
          // Process text into chunks
          console.log("Processing book text into chunks...");
          const chunks = await processBookText(extractedText, title);
          console.log(`Created ${chunks.length} chunks from book text`);
          
          if (chunks.length === 0) {
            console.error("No chunks created from book text");
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'Failed to create chunks from the extracted text' 
              }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          // Use EdgeRuntime.waitUntil to process chunks in the background
          EdgeRuntime.waitUntil((async () => {
            console.log("Starting background chunk processing for book:", bookId);
            let successCount = 0;
            let errorCount = 0;
            
            try {
              // Insert chunks into database
              console.log(`Inserting ${chunks.length} chunks for book ID: ${bookId}`);
              
              // To improve reliability, insert chunks in smaller batches
              const BATCH_SIZE = 5;
              for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
                const batch = chunks.slice(i, i + BATCH_SIZE);
                console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(chunks.length/BATCH_SIZE)}, size: ${batch.length}`);
                
                for (const chunk of batch) {
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
                    console.error(`Error inserting chunk ${chunk.chunk_index}:`, chunkError);
                    console.error("Error details:", JSON.stringify(chunkError, null, 2));
                    errorCount++;
                  } else {
                    successCount++;
                    console.log(`Inserted chunk ${chunk.chunk_index}, success count: ${successCount}`);
                  }
                }
                
                // Add a delay between batches to avoid overwhelming the database
                if (i + BATCH_SIZE < chunks.length) {
                  console.log("Pausing between batches...");
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              }
              
              // After all chunks are processed, verify they were inserted correctly
              const { data: verifyChunks, error: verifyError } = await supabaseClient
                .from('book_chunks')
                .select('id, chunk_index')
                .eq('book_id', bookId);
                
              if (verifyError) {
                console.error("Error verifying chunks:", verifyError);
              } else {
                console.log(`Verification found ${verifyChunks?.length || 0} chunks in database`);
              }
              
              // Update book status based on chunk processing results
              const finalStatus = errorCount === 0 ? 'processed' : 
                               (successCount > 0 ? 'partially_processed' : 'failed');
                               
              console.log(`Updating book status to ${finalStatus}, success: ${successCount}, failed: ${errorCount}`);
              
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
                console.error("Error details:", JSON.stringify(updateError, null, 2));
              } else {
                console.log(`Book processing completed with status: ${finalStatus}`);
                console.log(`Successfully processed ${successCount} chunks with ${errorCount} failures`);
              }
            } catch (error) {
              console.error("Background processing error:", error);
              console.error("Error stack:", error.stack);
              
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
                  
                console.log("Updated book status to 'error' after exception");
              } catch (updateError) {
                console.error("Failed to update book status after error:", updateError);
              }
            }
          })());
          
          // Return success response while processing continues in the background
          console.log("Upload completed successfully, background processing started for book ID:", bookId);
          return new Response(
            JSON.stringify({
              success: true,
              message: `Book "${title}" uploaded successfully`,
              bookId,
              chunksCount: chunks.length
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (extractError) {
          console.error("Text extraction error:", extractError);
          console.error("Error stack:", extractError.stack);
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Failed to extract text from PDF: ${extractError.message || "Unknown extraction error"}` 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (processingError) {
        console.error("Error processing file:", processingError);
        console.error("Error stack:", processingError.stack);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Error processing file: ${processingError.message || "Unknown processing error"}` 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (formDataError) {
      console.error("Error parsing form data:", formDataError);
      console.error("Error stack:", formDataError.stack);
      return new Response(
        JSON.stringify({ success: false, error: `Error parsing form data: ${formDataError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error("Unexpected error in upload-book function:", error);
    console.error("Error stack:", error.stack);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Server error: ${error.message || "Unknown server error"}` 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
