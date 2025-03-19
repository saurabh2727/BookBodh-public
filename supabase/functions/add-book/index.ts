
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get authentication token from request
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader) {
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

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { 
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        },
      }
    );

    // Get user ID from session
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({
          error: "Authentication failed",
          details: authError?.message
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get book details from request
    const { bookId, title, authors, category, previewLink } = await req.json();
    
    if (!bookId || !title) {
      return new Response(
        JSON.stringify({ error: "Book ID and title are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if book already exists for this user
    const { data: existingBooks, error: checkError } = await supabaseClient
      .from("books")
      .select("id")
      .eq("google_books_id", bookId)
      .eq("user_id", user.id);
      
    if (checkError) {
      console.error("Database check error:", checkError);
      throw new Error(`Database check failed: ${checkError.message}`);
    }
    
    if (existingBooks && existingBooks.length > 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          message: "This book is already in your library" 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate a unique ID for the book
    const uniqueBookId = crypto.randomUUID();

    // Create book record in database
    const { data: bookData, error: bookError } = await supabaseClient
      .from("books")
      .insert({
        id: uniqueBookId,
        google_books_id: bookId,
        title: title,
        author: Array.isArray(authors) ? authors.join(', ') : authors,
        category: category || "Uncategorized",
        preview_url: previewLink,
        user_id: user.id,
        status: "pending",
        summary: `Processing ${title}...`,
        chunks_count: 0
      })
      .select();
    
    if (bookError) {
      console.error("Database insert error:", bookError);
      throw new Error(`Error saving book metadata: ${bookError.message}`);
    }

    // Start background processing
    EdgeRuntime.waitUntil((async () => {
      try {
        console.log(`Starting background text extraction for book: ${title}`);
        
        // Update book status to processing
        await supabaseClient
          .from("books")
          .update({ status: "processing" })
          .eq("id", uniqueBookId);
        
        // In a real implementation, you would trigger a Python worker to:
        // 1. Use Selenium to navigate to the preview URL
        // 2. Take screenshots
        // 3. Extract text with OCR
        // 4. Store text chunks in the database
        
        // For now, we'll just update the status to simulate processing
        setTimeout(async () => {
          await supabaseClient
            .from("books")
            .update({ 
              status: "processed",
              summary: `${title} by ${Array.isArray(authors) ? authors.join(', ') : authors}. This book was added via Google Books.`
            })
            .eq("id", uniqueBookId);
          
          console.log(`Book processing completed: ${title}`);
        }, 3000);
      } catch (processError) {
        console.error("Error in background processing:", processError);
        
        await supabaseClient
          .from("books")
          .update({ 
            status: "error",
            summary: `Error processing book: ${processError.message}`
          })
          .eq("id", uniqueBookId);
      }
    })());

    return new Response(
      JSON.stringify({
        success: true,
        message: `Book "${title}" added successfully`,
        bookId: uniqueBookId
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
