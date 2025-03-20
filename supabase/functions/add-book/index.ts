import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// This is a new helper function to trigger extraction for a newly added book
async function triggerExtraction(bookId: string) {
  try {
    console.log(`Triggering extraction for book ${bookId}`);
    
    // Get the backend API URL from environment or use default
    const apiUrl = Deno.env.get("BACKEND_API_URL") || "https://ethical-wisdom-bot.lovable.app";
    const extractionUrl = `${apiUrl}/extract-book/${bookId}`;
    
    const response = await fetch(extractionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ book_id: bookId }),
    });
    
    if (response.ok) {
      console.log(`Extraction initiated successfully for book ${bookId}`);
      return true;
    } else {
      console.error(`Failed to initiate extraction for book ${bookId}: ${await response.text()}`);
      return false;
    }
  } catch (error) {
    console.error(`Error triggering extraction: ${error.message}`);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const { bookId, title, authors, category, previewLink } = await req.json();

    // Validate that required data is present
    if (!bookId || !title || !authors || !category) {
      return new Response(
        JSON.stringify({ error: "Missing required data" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: req.headers.get("Authorization")!,
          },
        },
      }
    );

    // Add book to database
    const { data, error } = await supabase
      .from("books")
      .insert([
        {
          id: bookId,
          title: title,
          author: authors.join(", "),
          category: category,
          icon_url: previewLink,
          status: 'pending'
        },
      ])
      .select()

    if (error) {
      console.error("Error adding book:", error);
      return new Response(
        JSON.stringify({ error: "Failed to add book" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // After successfully adding the book, trigger extraction in the background
    if (data && data.length > 0 && data[0].id) {
      const addedBookId = data[0].id;
      console.log(`Book added successfully with ID: ${addedBookId}. Triggering extraction...`);
      
      // Use Edge Runtime waitUntil to run extraction in the background
      EdgeRuntime.waitUntil((async () => {
        const extractionStarted = await triggerExtraction(addedBookId);
        
        if (extractionStarted) {
          // Update the book with extraction status
          await supabase
            .from('books')
            .update({ status: 'extracting' })
            .eq('id', addedBookId);
        }
      })());
      
      return new Response(
        JSON.stringify({
          success: true,
          message: `Book "${title}" added successfully and extraction started`,
          bookId: addedBookId,
          title: title,
          extractionTriggered: true
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      console.error("Book not added successfully or ID not found");
      return new Response(
        JSON.stringify({ error: "Book not added successfully or ID not found" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
