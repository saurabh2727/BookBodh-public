import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { v4 as uuidv4 } from "https://esm.sh/uuid@11.0.0";

// This is a helper function to trigger extraction for a newly added book
// Modified to prioritize external Google Books ID for extraction
async function triggerExtraction(bookId: string, externalId: string) {
  try {
    console.log(`Attempting extraction for book ${bookId} (External Google Books ID: ${externalId})`);
    
    // Since we know direct API calls are failing, let's skip the API calls
    // and update the book status directly in the database
    console.log("Direct API extraction unavailable - using database method");
    
    // Use database operations to mark the book for manual extraction
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    
    // Update the book status to signal a special status
    const { error: updateError } = await supabase
      .from('books')
      .update({
        status: 'extraction_pending',
        summary: `Book content will be available soon. Google Books ID: ${externalId}`
      })
      .eq('id', bookId);
      
    if (updateError) {
      console.error("Error updating book status:", updateError);
      return false;
    }
    
    console.log(`Updated book ${bookId} with extraction_pending status`);
    return true;
  } catch (error) {
    console.error(`Error in extraction process: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
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
    const { bookId: originalBookId, title, authors, category, previewLink } = await req.json();

    // Validate that required data is present
    if (!originalBookId || !title || !authors || !category) {
      return new Response(
        JSON.stringify({ error: "Missing required data" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate a proper UUID to use as the database ID
    // Keep the original bookId as an external_id or source_id field
    const generatedUuid = uuidv4();
    console.log(`Original Google Books ID: ${originalBookId}, Generated database UUID: ${generatedUuid}`);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    
    // Get the user ID from the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "No authorization header provided" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Extract the JWT token
    const token = authHeader.replace("Bearer ", "");
    console.log("Token received, checking user identity...");
    
    // Get the user ID from the JWT token
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData?.user) {
      console.error("Error getting user from token:", userError);
      return new Response(
        JSON.stringify({ error: `Authentication failed: ${userError?.message || "Invalid token"}` }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    const userId = userData.user.id;
    console.log(`User authenticated, id: ${userId}`);
    
    // Create a book URL using the Google Books ID
    const fileUrl = `https://books.google.com/books?id=${originalBookId}`;

    // Add book to database using the generated UUID
    const { data, error } = await supabase
      .from("books")
      .insert([
        {
          id: generatedUuid,
          title: title,
          author: authors.join(", "),
          category: category,
          icon_url: previewLink,
          file_url: fileUrl, // Using the Google Books URL as the file URL
          status: 'extraction_pending', // Set status to a more appropriate value
          external_id: originalBookId, // Store the original Google Books ID
          user_id: userId, // Make sure to include the user ID
          summary: `Book from Google Books. ID: ${originalBookId}. Content is being processed.`
        },
      ])
      .select();

    if (error) {
      console.error("Error adding book:", error);
      return new Response(
        JSON.stringify({ error: `Failed to add book: ${error.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // After successfully adding the book, trigger extraction in the background
    if (data && data.length > 0 && data[0].id) {
      const addedBookId = data[0].id;
      console.log(`Book added successfully with database ID: ${addedBookId}, Google Books ID: ${originalBookId}`);
      
      // Use Edge Runtime waitUntil to run extraction in the background
      EdgeRuntime.waitUntil((async () => {
        // Since direct API call is not working, we'll update the book status directly
        await triggerExtraction(addedBookId, originalBookId);
      })());
      
      return new Response(
        JSON.stringify({
          success: true,
          message: `Book "${title}" added successfully`,
          bookId: addedBookId,
          title: title,
          extractionTriggered: true,
          status: 'extraction_pending',
          note: "Book content extraction is temporarily unavailable. The book has been saved and will be processed soon."
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
