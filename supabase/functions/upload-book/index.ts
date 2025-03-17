import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Get the chunk size from environment or use a default
const CHUNK_SIZE = parseInt(Deno.env.get("CHUNK_SIZE") || "1000");
const CHUNK_OVERLAP = parseInt(Deno.env.get("CHUNK_OVERLAP") || "200");
const FASTAPI_BACKEND_URL = Deno.env.get("FASTAPI_BACKEND_URL") || "https://ethical-wisdom-bot.lovable.app/upload-book";
const BUCKET_NAME = "books";

async function fallbackTextExtraction(pdfData: Uint8Array): Promise<string> {
  console.warn("Using fallback text extraction method");
  
  // This is a very basic extraction - it may not work well for all PDFs
  const decoder = new TextDecoder("utf-8");
  const pdfText = decoder.decode(pdfData);
  
  // Look for text content between markers
  const textSegments = pdfText.match(/BT.*?ET/gs) || [];
  
  // Extract text from these segments
  let extractedText = "";
  for (const segment of textSegments) {
    // Extract anything that looks like text
    const textMatches = segment.match(/\[(.*?)\]/g) || [];
    for (const match of textMatches) {
      extractedText += match.replace(/[\[\]]/g, "") + " ";
    }
  }
  
  return extractedText.trim() || "Failed to extract text using fallback method";
}

function isTextExtractedSuccessfully(text: string): boolean {
  if (!text) return false;
  if (text.length < 100) return false;
  
  // Check for common error messages
  const errorPatterns = [
    "Failed to extract",
    "Error extracting",
    "Could not extract",
    "extraction failed",
  ];
  
  for (const pattern of errorPatterns) {
    if (text.toLowerCase().includes(pattern.toLowerCase())) {
      return false;
    }
  }
  
  return true;
}

async function extractTextWithFastAPI(fileData: ArrayBuffer, fileName: string): Promise<string> {
  try {
    console.log("Attempting to extract text using FastAPI backend...");
    
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileData)], { type: "application/pdf" });
    formData.append("file", blob, fileName);
    
    const response = await fetch(FASTAPI_BACKEND_URL, {
      method: "POST",
      body: formData,
      headers: {
        "Accept": "application/json",
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FastAPI returned error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.text && isTextExtractedSuccessfully(result.text)) {
      console.log("Successfully extracted text with FastAPI backend");
      return result.text;
    }
    
    console.warn("FastAPI text extraction failed or produced low-quality results");
    throw new Error("FastAPI text extraction failed to produce usable text");
  } catch (error) {
    console.warn("FastAPI extraction failed:", error.message);
    
    // Try fallback method
    try {
      console.warn("Falling back to manual extraction");
      return await fallbackTextExtraction(new Uint8Array(fileData));
    } catch (fallbackError) {
      console.error("All text extraction methods failed");
      throw new Error("Failed to extract text from PDF using all available methods");
    }
  }
}

function chunkText(text: string): string[] {
  // Split text into sentences
  const sentences = text.replace(/([.?!])\s*(?=[A-Z])/g, "$1|").split("|");
  
  // Initialize chunks
  const chunks: string[] = [];
  let currentChunk = "";
  
  // Process sentences into chunks
  for (const sentence of sentences) {
    // If adding this sentence would exceed the chunk size, start a new chunk
    if (currentChunk.length + sentence.length > CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push(currentChunk);
      
      // Start the new chunk with overlap from the previous chunk
      const words = currentChunk.split(" ");
      if (words.length > CHUNK_OVERLAP / 5) { // Approximate words for overlap
        currentChunk = words.slice(-Math.floor(CHUNK_OVERLAP / 5)).join(" ") + " ";
      } else {
        currentChunk = "";
      }
    }
    
    currentChunk += sentence + " ";
  }
  
  // Add the last chunk if it's not empty
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

async function processBookText(bookId: string, title: string, text: string, supabaseClient: any, userId: string): Promise<number> {
  // Split the text into chunks
  const chunks = chunkText(text);
  console.log(`Split book into ${chunks.length} chunks`);
  
  // Insert chunks into the database
  const chunkPromises = chunks.map(async (chunkText, index) => {
    const { data: chunkData, error: chunkError } = await supabaseClient
      .from("book_chunks")
      .insert({
        book_id: bookId,
        chunk_index: index,
        title: title,
        text: chunkText,
      });
    
    if (chunkError) {
      console.error(`Error storing chunk ${index}:`, chunkError);
      throw chunkError;
    }
    
    return chunkData;
  });
  
  // Wait for all chunks to be processed
  await Promise.all(chunkPromises);
  
  // Update book with chunks count
  const { error: updateError } = await supabaseClient
    .from("books")
    .update({ 
      status: "processed",
      chunks_count: chunks.length 
    })
    .eq("id", bookId);
  
  if (updateError) {
    console.error("Error updating book with chunks count:", updateError);
    throw updateError;
  }
  
  return chunks.length;
}

async function createBookSummary(bookId: string, text: string, supabaseClient: any): Promise<void> {
  try {
    // For now, just create a simple summary (first 500 chars + ...)
    const simpleSummary = text.substring(0, 500) + (text.length > 500 ? "..." : "");
    
    // Update the book with the summary
    const { error: summaryError } = await supabaseClient
      .from("books")
      .update({ summary: simpleSummary })
      .eq("id", bookId);
    
    if (summaryError) {
      console.error("Error updating book with summary:", summaryError);
      throw summaryError;
    }
  } catch (error) {
    console.error("Error creating book summary:", error);
    // Don't throw, as this is not critical
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request for CORS preflight");
    return new Response("ok", { 
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain"
      } 
    });
  }
  
  try {
    // Get authentication token from request
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader) {
      console.log("Missing Authorization header");
      return new Response(
        JSON.stringify({
          error: "Missing Authorization header",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Create a Supabase client with the user's JWT
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { 
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
      }
    );
    
    // Get the authenticated user from JWT
    let jwtUser;
    try {
      const { data, error } = await supabaseClient.auth.getUser();
      
      if (error) {
        console.error("Authentication error:", error);
        return new Response(
          JSON.stringify({
            error: "Authentication failed",
            details: error.message,
            code: error.code
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      if (!data.user) {
        console.error("No user found in JWT");
        return new Response(
          JSON.stringify({
            error: "Authentication failed",
            details: "User not found in JWT"
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      jwtUser = data.user;
      console.log("JWT user ID:", jwtUser.id);
    } catch (authError) {
      console.error("Error getting user from JWT:", authError);
      return new Response(
        JSON.stringify({
          error: "Authentication error",
          details: authError instanceof Error ? authError.message : "Unknown error"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Parse the multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const author = formData.get("author") as string;
    const category = formData.get("category") as string;
    
    // Validation
    if (!file || !title) {
      return new Response(
        JSON.stringify({ error: "File and title are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Check file type
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return new Response(
        JSON.stringify({ error: "Only PDF files are allowed" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Generate a unique ID for the book
    const bookId = crypto.randomUUID();
    
    // Upload the file to storage
    const filePath = `${jwtUser.id}/${file.name.replace(/\s+/g, "_")}`;
    const fileData = await file.arrayBuffer();
    
    console.log(`Uploading file ${file.name} to storage path: ${filePath}`);
    
    const { data: uploadData, error: uploadError } = await supabaseClient
      .storage
      .from(BUCKET_NAME)
      .upload(filePath, fileData, {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: false
      });
    
    if (uploadError) {
      console.error("File upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: `Error uploading file: ${uploadError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    console.log("File uploaded successfully");
    
    // Get the public URL for the file
    const { data: urlData } = await supabaseClient
      .storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);
    
    const fileUrl = urlData?.publicUrl;
    
    // Create book record in database
    console.log("Creating book record in database with user_id:", jwtUser.id);
    
    const { data: bookData, error: bookError } = await supabaseClient
      .from("books")
      .insert({
        id: bookId,
        title,
        author: author || "Unknown",
        category: category || "Uncategorized",
        file_url: fileUrl,
        user_id: jwtUser.id, // Use jwtUser.id to ensure it matches auth.uid()
        status: "uploading",
        summary: `Processing ${title}...`
      })
      .select();
    
    if (bookError) {
      console.error("Database insert error:", bookError);
      if (bookError.message.includes("violates row-level security policy")) {
        console.error("RLS violation:", bookError.message, bookError.details);
      }
      
      return new Response(
        JSON.stringify({ 
          error: `Error saving book metadata: ${bookError.message}`,
          details: bookError
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    console.log("Book metadata saved successfully");
    
    // Update book status to "extracting"
    await supabaseClient
      .from("books")
      .update({ status: "extracting" })
      .eq("id", bookId);
    
    // Extract text from PDF
    console.log("Extracting text from PDF...");
    let extractedText;
    try {
      // Use the FastAPI backend for text extraction
      extractedText = await extractTextWithFastAPI(fileData, file.name);
      
      if (!extractedText || extractedText.length < 100) {
        throw new Error("Failed to extract meaningful text from the PDF");
      }
      
      console.log(`Successfully extracted ${extractedText.length} characters of text`);
    } catch (extractError) {
      console.error("Text extraction failed:", extractError);
      
      await supabaseClient
        .from("books")
        .update({ 
          status: "error",
          summary: `Error extracting text: ${extractError.message}`
        })
        .eq("id", bookId);
      
      return new Response(
        JSON.stringify({ 
          error: `Text extraction failed: ${extractError.message}`,
          bookId,
          fileUrl
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Update book status to "processing"
    await supabaseClient
      .from("books")
      .update({ status: "processing" })
      .eq("id", bookId);
    
    // Process the book text into chunks in background
    EdgeRuntime.waitUntil((async () => {
      // Process the book text into chunks
      console.log("Processing book text into chunks...");
      let chunksCount;
      try {
        chunksCount = await processBookText(bookId, title, extractedText, supabaseClient, jwtUser.id);
      } catch (processError) {
        console.error("Error processing book text:", processError);
        
        await supabaseClient
          .from("books")
          .update({ 
            status: "error",
            summary: `Error processing text: ${processError.message}`
          })
          .eq("id", bookId);
        
        return;
      }
      
      // Create a summary for the book
      console.log("Creating book summary...");
      try {
        await createBookSummary(bookId, extractedText, supabaseClient);
      } catch (summaryError) {
        console.warn("Error creating book summary:", summaryError);
        // Continue even if summary creation fails
      }
    })());
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Book "${title}" uploaded and processed successfully`,
        bookId,
        fileUrl
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    
    return new Response(
      JSON.stringify({ 
        error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        stack: error instanceof Error ? error.stack : undefined
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
