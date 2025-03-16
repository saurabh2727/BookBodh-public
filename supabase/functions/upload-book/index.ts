
// supabase/functions/upload-book/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { v4 as uuidv4 } from 'https://esm.sh/uuid@9';

// The maximum file size allowed (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;  // 50MB in bytes

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
        // Upload the file to storage bucket (or wherever you want to store it)
        // This is simplified - in a real app, you'd upload to Supabase Storage or similar
        console.log("Processing file...");
        
        // Here's where you would extract text from the PDF, process it, etc.
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
        
        // Extract text and create chunks (simplified, in real app would use a PDF parser)
        // Here we'll just create a mock summary
        const summary = `Summary of ${title} by ${author}. This is a book about various concepts and ideas in the category of ${category}.`;
        console.log("Created summary for book");
        
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
              status: 'processed'
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
        
        // Insert sample book chunks (in a real app, would create actual chunks from PDF content)
        const { error: chunkError } = await supabaseClient
          .from('book_chunks')
          .insert([
            {
              book_id: bookId,
              chunk_index: 0,
              title,
              text: `This is a sample chunk from ${title}. In a real application, this would contain actual content from the PDF.`,
              summary: `Summary of chunk 0 from ${title}`
            }
          ]);
          
        if (chunkError) {
          console.error("Error inserting book chunks:", chunkError);
          // We don't want to fail the whole operation if chunk insertion fails
          console.log("Continuing despite chunk insertion error");
        } else {
          console.log("Book chunks inserted successfully");
        }
        
        // Return success response
        console.log("Upload completed successfully");
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
        return new Response(
          JSON.stringify({ success: false, message: `Error processing file: ${processingError.message}` }),
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
    return new Response(
      JSON.stringify({ success: false, message: `Server error: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
