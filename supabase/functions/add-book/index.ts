
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Manually decode JWT token to extract user ID
async function decodeJWT(token) {
  try {
    console.log("Decoding JWT token, length:", token.length);
    
    // Remove 'Bearer ' prefix if present
    const actualToken = token.startsWith("Bearer ") ? token.substring(7) : token;
    
    // Split the token and grab the payload part
    const parts = actualToken.split(".");
    if (parts.length !== 3) {
      console.error("Invalid token format, parts:", parts.length);
      throw new Error("Invalid JWT token format");
    }
    
    // Decode the payload
    const payload = parts[1];
    const decodedPayload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(payload), (c) => c.charCodeAt(0))
      )
    );
    
    console.log("Successfully decoded JWT payload", {
      sub: decodedPayload.sub,
      exp: decodedPayload.exp ? new Date(decodedPayload.exp * 1000).toISOString() : 'missing',
      iat: decodedPayload.iat ? new Date(decodedPayload.iat * 1000).toISOString() : 'missing',
      role: decodedPayload.role
    });
    
    return decodedPayload;
  } catch (error) {
    console.error("JWT decode error:", error);
    throw new Error(`Failed to decode JWT: ${error.message}`);
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
    // Log request details for debugging
    console.log("Request method:", req.method);
    console.log("Request headers:", Object.fromEntries(req.headers.entries()));
    
    // Get authentication token from request
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader) {
      console.error("Missing Authorization header");
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
    
    // Parse the request body
    const { bookId, title, authors, category, previewLink } = await req.json();
    
    // Validate required fields
    if (!bookId || !title) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required fields", 
          required: "bookId and title are required" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Create a service role Supabase client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );
    
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
    
    // Generate a UUID for the book
    const newBookId = crypto.randomUUID();
    
    // Log database operation attempt
    console.log("Attempting to insert book with following data:", {
      id: newBookId,
      title: title,
      author: Array.isArray(authors) ? authors.join(", ") : authors || "Unknown",
      category: category || "Uncategorized",
      file_url: previewLink, // Using previewLink as file_url since there's no preview_link column
      user_id: userId
    });
    
    // Add book to database
    const { data, error } = await supabaseAdmin
      .from("books")
      .insert({
        id: newBookId,
        title: title,
        author: Array.isArray(authors) ? authors.join(", ") : authors || "Unknown",
        category: category || "Uncategorized",
        file_url: previewLink, // Changed from preview_link to file_url to match the schema
        user_id: userId,
        status: "active",
        summary: `Book added from Google Books: ${title}`,
        chunks_count: 0
      })
      .select('id, title')
      .single();
    
    if (error) {
      console.error("Database insert error:", error);
      return new Response(
        JSON.stringify({ 
          error: `Error saving book: ${error.message}`,
          details: error
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: `Book "${title}" added successfully`,
        bookId: data.id
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
