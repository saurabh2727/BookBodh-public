
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { decode } from "https://deno.land/x/djwt@v3.0.1/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

// Get the chunk size from environment or use a default
const CHUNK_SIZE = parseInt(Deno.env.get("CHUNK_SIZE") || "1000");
const CHUNK_OVERLAP = parseInt(Deno.env.get("CHUNK_OVERLAP") || "200");
const FASTAPI_BACKEND_URL = Deno.env.get("FASTAPI_BACKEND_URL") || "https://ethical-wisdom-bot.lovable.app/upload-book";
const BUCKET_NAME = "books";

// Manually decode JWT token to extract user ID
async function decodeJWT(token) {
  try {
    console.log("Attempting to decode JWT token");
    // Remove 'Bearer ' prefix if present
    const actualToken = token.startsWith("Bearer ") ? token.substring(7) : token;
    
    // Split the token and grab the payload part
    const [header, payload, signature] = actualToken.split(".");
    
    if (!header || !payload || !signature) {
      throw new Error("Invalid JWT token format");
    }
    
    // Decode the payload
    const decodedPayload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
      )
    );
    
    console.log("Successfully decoded JWT payload", {
      sub: decodedPayload.sub,
      exp: decodedPayload.exp,
      iat: decodedPayload.iat,
      role: decodedPayload.role
    });
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (decodedPayload.exp && decodedPayload.exp < now) {
      throw new Error("JWT token has expired");
    }
    
    return decodedPayload;
  } catch (error) {
    console.error("JWT decode error:", error);
    throw new Error(`Failed to decode JWT: ${error.message}`);
  }
}

/**
 * Improved text extraction from PDF data using pattern matching
 * This is a more robust approach than the previous attempt
 */
async function extractTextFromPDF(pdfData: Uint8Array): Promise<string> {
  console.log("Starting enhanced text extraction process");
  
  try {
    // Convert PDF data to string representation (for text pattern extraction)
    const decoder = new TextDecoder("utf-8", { fatal: false, ignoreBOM: true });
    let rawText = decoder.decode(pdfData);
    
    // Clean up initial conversion to help with extraction
    rawText = rawText.replace(/\x00/g, " "); // Replace null bytes
    
    // Advanced pattern extraction for PDF content
    let extractedText = "";
    
    // Extract text streams - Pattern: Look for text between stream and endstream
    const textStreamMatches = rawText.match(/stream\s+([\s\S]+?)\s+endstream/g) || [];
    console.log(`Found ${textStreamMatches.length} text streams in PDF`);
    
    for (const streamMatch of textStreamMatches) {
      // Process each stream to extract readable text
      // Focus only on streams with text content (TJ, Tj operators)
      if (streamMatch.includes("TJ") || streamMatch.includes("Tj")) {
        // Extract text within parentheses (typical PDF text format)
        const textPartsMatch = streamMatch.match(/\((.*?)\)/g) || [];
        
        for (const textPart of textPartsMatch) {
          // Remove the parentheses and decode escape sequences
          let cleanedText = textPart.substring(1, textPart.length - 1)
            .replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
            .replace(/\\n/g, "\n")
            .replace(/\\r/g, "\r")
            .replace(/\\t/g, "\t")
            .replace(/\\\\/g, "\\")
            .replace(/\\\(/g, "(")
            .replace(/\\\)/g, ")");
            
          // Only add if it's printable text (not control codes)
          if (/[a-zA-Z0-9.,;:!?' ]/.test(cleanedText)) {
            extractedText += cleanedText + " ";
          }
        }
      }
    }
    
    // Secondary extraction method: Looking for normal text patterns
    if (extractedText.trim().length < 100) {
      console.log("Primary extraction method yielded insufficient results, trying secondary method");
      
      // Try to extract any text-like content with reasonable length
      const textLikePattern = /[a-zA-Z0-9][a-zA-Z0-9.,;:!?' ]{10,}/g;
      const textMatches = rawText.match(textLikePattern) || [];
      
      console.log(`Found ${textMatches.length} potential text segments using secondary method`);
      
      // Filter out segments that are clearly not natural text
      const validTextSegments = textMatches
        .filter(segment => {
          // Check if segment has a reasonable word-to-character ratio
          const words = segment.split(/\s+/).filter(w => w.length > 0);
          return (words.length / segment.length) > 0.05; // Reasonable text has spaces
        })
        .filter(segment => {
          // Filter out segments with too many special characters
          const specialCharCount = (segment.match(/[^a-zA-Z0-9.,;:!?' ]/g) || []).length;
          return (specialCharCount / segment.length) < 0.2; // Less than 20% special chars
        });
      
      extractedText += validTextSegments.join(" ");
    }
    
    // Fallback: Use FastAPI backend if available and our extraction failed
    if (extractedText.trim().length < 100 && FASTAPI_BACKEND_URL) {
      console.log("Local extraction methods failed, trying FastAPI backend");
      
      try {
        const formData = new FormData();
        formData.append("file", new Blob([pdfData]), "document.pdf");
        
        const response = await fetch(FASTAPI_BACKEND_URL, {
          method: "POST",
          body: formData,
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.text && result.text.length > 100) {
            console.log("FastAPI extraction successful");
            return result.text;
          }
        }
      } catch (backendError) {
        console.error("FastAPI backend extraction failed:", backendError);
        // Continue with our local extraction results
      }
    }
    
    // Final clean-up of extracted text
    extractedText = extractedText
      .replace(/\s+/g, " ")  // Normalize whitespace
      .trim();
    
    console.log(`Extracted ${extractedText.length} characters of text`);
    
    if (extractedText.length < 50) {
      console.warn("Warning: Very little text was extracted from the PDF");
      // Create a minimal placeholder text with information about the document
      return `This document appears to contain minimal extractable text. It may be a scanned document or have security settings that prevent text extraction. Document size: ${pdfData.length} bytes.`;
    }
    
    return extractedText;
  } catch (error) {
    console.error("Error in text extraction:", error);
    return `Failed to extract text: ${error.message}. This document may be encrypted, a scanned image, or have security settings that prevent text extraction.`;
  }
}

// Function to clean text by removing null bytes and invalid Unicode characters
function cleanText(text: string): string {
  if (!text) return "";
  
  // Remove null bytes
  let cleaned = text.replace(/\u0000/g, "");
  
  // Replace other problematic characters
  cleaned = cleaned.replace(/[\uD800-\uDFFF]/g, ""); // Remove unpaired surrogates
  
  // Replace control characters except common whitespace chars
  cleaned = cleaned.replace(/[\u0001-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, "");
  
  // Replace any characters that might cause issues with JSON
  cleaned = cleaned.replace(/[\u2028\u2029]/g, " ");
  
  // Clean up binary-looking data
  cleaned = cleaned.replace(/[^\x20-\x7E\s]/g, " "); // Keep only printable ASCII and whitespace
  
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  return cleaned;
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
  // First clean the text to remove problematic characters
  const cleanedText = cleanText(text);
  
  // Split the text into chunks
  const chunks = chunkText(cleanedText);
  console.log(`Split book into ${chunks.length} chunks`);
  
  // Insert chunks into the database
  const chunkPromises = chunks.map(async (chunkText, index) => {
    try {
      // Clean the chunk text again just to be sure
      const sanitizedChunkText = cleanText(chunkText);
      
      const { data: chunkData, error: chunkError } = await supabaseClient
        .from("book_chunks")
        .insert({
          book_id: bookId,
          chunk_index: index,
          title: title,
          text: sanitizedChunkText,
        });
      
      if (chunkError) {
        console.error(`Error storing chunk ${index}:`, chunkError);
        throw chunkError;
      }
      
      return chunkData;
    } catch (err) {
      console.error(`Failed to insert chunk ${index}:`, err);
      // Continue with other chunks even if one fails
      return null;
    }
  });
  
  // Wait for all chunks to be processed
  const results = await Promise.allSettled(chunkPromises);
  
  // Count successful insertions
  const successfulChunks = results.filter(r => r.status === "fulfilled" && r.value !== null).length;
  
  // Update book with chunks count
  const { error: updateError } = await supabaseClient
    .from("books")
    .update({ 
      status: successfulChunks > 0 ? "processed" : "error",
      chunks_count: successfulChunks 
    })
    .eq("id", bookId);
  
  if (updateError) {
    console.error("Error updating book with chunks count:", updateError);
    throw updateError;
  }
  
  return successfulChunks;
}

async function createBookSummary(bookId: string, text: string, supabaseClient: any): Promise<void> {
  try {
    // Create a simple summary (first 500 chars + ...)
    const cleanedText = cleanText(text);
    const simpleSummary = cleanedText.substring(0, 500) + (cleanedText.length > 500 ? "..." : "");
    
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

// Check if a storage bucket exists
async function checkBucketExists(supabaseClient: any, bucketName: string): Promise<boolean> {
  try {
    console.log(`Checking if bucket '${bucketName}' exists...`);
    const { data: buckets, error } = await supabaseClient.storage.listBuckets();
    
    if (error) {
      console.error("Error listing buckets:", error);
      return false;
    }
    
    const bucketExists = buckets && buckets.some(b => b.name === bucketName);
    console.log(`Bucket '${bucketName}' ${bucketExists ? 'exists' : 'does not exist'}`);
    return bucketExists;
  } catch (error) {
    console.error("Error checking bucket existence:", error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request for CORS preflight");
    return new Response(null, { 
      status: 204,
      headers: corsHeaders
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
    
    console.log("Authorization header present, length:", authHeader.length);
    
    // Manually decode the JWT to get the user ID
    let userId;
    try {
      const decodedToken = await decodeJWT(authHeader);
      userId = decodedToken.sub;
      
      if (!userId) {
        console.error("No user ID (sub) found in JWT token");
        throw new Error("Invalid JWT token: missing subject (user ID)");
      }
      
      console.log("User ID extracted from JWT:", userId);
    } catch (jwtError) {
      console.error("JWT validation error:", jwtError);
      return new Response(
        JSON.stringify({
          error: "Authentication failed",
          details: jwtError.message
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Create a Supabase client with the auth header for RLS
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", // Use service role key for bucket creation
      {
        global: { headers: { Authorization: authHeader } },
        auth: { 
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
      }
    );
    
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
    const filePath = `${userId}/${file.name.replace(/\s+/g, "_")}`;
    const fileData = await file.arrayBuffer();
    
    console.log(`Uploading file ${file.name} to storage path: ${filePath}`);
    
    // Create a service-role client for bucket operations
    const serviceRoleClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: { 
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
      }
    );
    
    // Check if the bucket exists, create if it doesn't
    const bucketExists = await checkBucketExists(serviceRoleClient, BUCKET_NAME);
    
    if (!bucketExists) {
      console.log(`Bucket '${BUCKET_NAME}' not found, creating it...`);
      try {
        const { data: newBucket, error: bucketError } = await serviceRoleClient.storage.createBucket(BUCKET_NAME, {
          public: false,
          fileSizeLimit: 10485760, // 10MB limit
        });
        
        if (bucketError) {
          console.error("Error creating bucket:", bucketError);
          return new Response(
            JSON.stringify({ error: `Error creating storage bucket: ${bucketError.message}` }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        
        console.log("Storage bucket created successfully:", newBucket);
      } catch (createError) {
        console.error("Unexpected error creating bucket:", createError);
        return new Response(
          JSON.stringify({ error: `Unexpected error creating bucket: ${createError.message}` }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }
    
    // Upload file using the service role client
    const { data: uploadData, error: uploadError } = await serviceRoleClient
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
    const { data: urlData } = await serviceRoleClient
      .storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);
    
    const fileUrl = urlData?.publicUrl;
    
    // Create book record in database
    console.log("Creating book record in database with user_id:", userId);
    
    const { data: bookData, error: bookError } = await supabaseClient
      .from("books")
      .insert({
        id: bookId,
        title,
        author: author || "Unknown",
        category: category || "Uncategorized",
        file_url: fileUrl,
        user_id: userId, // Use extracted userId from JWT token
        status: "uploading",
        summary: `Processing ${title}...`,
        chunks_count: 0 // Initialize with zero chunks
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
      // Use our enhanced text extraction
      extractedText = await extractTextFromPDF(new Uint8Array(fileData));
      
      if (!extractedText || extractedText.length < 100) {
        console.warn("Warning: Minimal text extracted, setting a placeholder message");
        extractedText = `This document appears to have limited extractable text. It may be a scanned document or protected PDF. File size: ${fileData.byteLength} bytes.`;
      }
      
      // Clean the extracted text to remove null bytes and invalid characters
      extractedText = cleanText(extractedText);
      
      console.log(`Successfully extracted ${extractedText.length} characters of text`);
      console.log("Sample extracted text:", extractedText.substring(0, 200));
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
        chunksCount = await processBookText(bookId, title, extractedText, supabaseClient, userId);
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
        fileUrl,
        chunksCount: 0 // Initial count, will be updated asynchronously
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
