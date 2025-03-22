import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { v4 as uuidv4 } from "https://esm.sh/uuid@11.0.0";

// This is a helper function to trigger extraction for a newly added book
// Modified to prioritize external Google Books ID for extraction
async function triggerExtraction(bookId: string, externalId: string) {
  try {
    console.log(`Triggering extraction for book ${bookId} (External Google Books ID: ${externalId})`);
    
    // Get the backend API URL from environment or use default with new project name
    const apiUrl = Deno.env.get("BACKEND_API_URL") || "https://bookbodh.lovable.app";
    
    // Add trailing slash if needed
    const baseUrl = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    
    // IMPORTANT: Make sure we're hitting the API endpoint, not the frontend route
    // Always use /api prefix to ensure we're hitting the backend API
    const extractionUrl = `${baseUrl}/api/extract-book/${bookId}`;
    
    console.log(`Calling extraction API at: ${extractionUrl}`);
    console.log(`Payload: { book_id: ${bookId}, external_id: ${externalId} }`);
    
    // Set timeout to 30 seconds to give the server enough time to respond
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      const response = await fetch(extractionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          book_id: bookId,
          external_id: externalId,
          force: true // Always force extraction to ensure it happens
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Log detailed response information for debugging
      console.log(`Response status: ${response.status}`);
      console.log(`Response content type: ${response.headers.get('content-type')}`);
      
      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        console.log(`Extraction API response: ${JSON.stringify(result)}`);
        return true;
      } else {
        // If not JSON, log the text response for debugging
        const textResponse = await response.text();
        console.error(`Non-JSON response received: ${textResponse.substring(0, 500)}...`);
        
        // Check if this is likely an HTML error page
        if (textResponse.includes('<!DOCTYPE') || textResponse.includes('<html>')) {
          console.error('Received HTML response instead of JSON. The backend endpoint might be returning an error page.');
          console.error(`This suggests we are hitting the frontend instead of the API - need to use the correct API URL: ${extractionUrl}`);
          console.error(`Current project name is 'bookbodh', make sure backend is configured correctly`);
        }
        
        return false;
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error(`Request timed out after 30 seconds: ${extractionUrl}`);
      } else {
        console.error(`Fetch error in triggerExtraction: ${fetchError.message}`);
        console.error(`Stack trace: ${fetchError.stack}`);
      }
      return false;
    }
  } catch (error) {
    console.error(`Error triggering extraction: ${error.message}`);
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
    
    // Create a fake file URL since we don't have an actual file
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
          status: 'extracting', // Set status to extracting immediately
          external_id: originalBookId, // Store the original Google Books ID
          user_id: userId // Make sure to include the user ID
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
      // IMPORTANT: We're passing both the database UUID and the original Google Books ID
      EdgeRuntime.waitUntil((async () => {
        const extractionStarted = await triggerExtraction(addedBookId, originalBookId);
        
        if (!extractionStarted) {
          // Update the book with error status if extraction failed to start
          await supabase
            .from('books')
            .update({ status: 'error', summary: 'Failed to start extraction process' })
            .eq('id', addedBookId);
        }
      })());
      
      return new Response(
        JSON.stringify({
          success: true,
          message: `Book "${title}" added successfully and extraction started`,
          bookId: addedBookId,
          title: title,
          extractionTriggered: true,
          status: 'extracting'
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
