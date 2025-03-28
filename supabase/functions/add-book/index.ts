
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { v4 as uuidv4 } from "https://esm.sh/uuid@11.0.0";

// This function attempts to extract content directly from Google Books API
async function extractFromGoogleBooks(bookId: string, externalId: string) {
  try {
    console.log(`Attempting to extract content for book ${bookId} using Google Books API ID: ${externalId}`);
    
    // Call Google Books API to get book details
    const googleBooksUrl = `https://www.googleapis.com/books/v1/volumes/${externalId}?fields=volumeInfo(title,authors,description,previewLink,infoLink,subtitle,pageCount),searchInfo,accessInfo(viewability,textToSpeechPermission,pdf,epub,webReaderLink,publicDomain)`;
    console.log(`Calling Google Books API: ${googleBooksUrl}`);
    
    const response = await fetch(googleBooksUrl);
    if (!response.ok) {
      console.error(`Google Books API error: ${response.status} ${response.statusText}`);
      return { success: false, error: `Google Books API error: ${response.status}` };
    }
    
    const bookData = await response.json();
    
    // Check if there's a text snippet or description we can use
    let content = "";
    let summary = "";
    
    if (bookData.volumeInfo?.description) {
      summary = bookData.volumeInfo.description;
      content += "Book Description: " + summary + "\n\n";
    }
    
    if (bookData.searchInfo?.textSnippet) {
      content += "Preview Snippet: " + bookData.searchInfo.textSnippet + "\n\n";
    }
    
    // Get any available text snippets from the volume info
    if (bookData.volumeInfo?.preface) {
      content += "Preface: " + bookData.volumeInfo.preface + "\n\n";
    }
    
    if (bookData.volumeInfo?.subtitle) {
      content += "Subtitle: " + bookData.volumeInfo.subtitle + "\n\n";
    }
    
    // Add page count information if available
    if (bookData.volumeInfo?.pageCount) {
      content += `Page Count: ${bookData.volumeInfo.pageCount}\n\n`;
    }
    
    // Additional attempt to extract from Google Books Viewer if available
    let previewAvailable = false;
    let previewUrl = "";
    let webReaderLink = "";
    
    if (bookData.accessInfo) {
      // Check if preview is available
      if (bookData.accessInfo.viewability === "PARTIAL" || bookData.accessInfo.viewability === "ALL_PAGES") {
        previewAvailable = true;
        
        // Get webReaderLink if available (better for iframe embedding)
        if (bookData.accessInfo.webReaderLink) {
          webReaderLink = bookData.accessInfo.webReaderLink;
        }
        
        // Get Google Books preview URL using the enhanced format
        previewUrl = `https://www.google.com/books/edition/_/${externalId}?hl=en&gbpv=1`;
        
        console.log(`Preview is available for this book at: ${previewUrl}`);
        console.log(`Web reader link: ${webReaderLink}`);
        
        // Add preview URL to the content for reference
        content += `\nA preview of this book is available at: ${previewUrl}\n\n`;
        
        // Additional format for embedding
        content += `\nEmbed link: ${webReaderLink || previewUrl}\n\n`;
        
        // Try to get more details about available formats
        if (bookData.accessInfo.pdf?.isAvailable) {
          content += "PDF version is available.\n";
        }
        
        if (bookData.accessInfo.epub?.isAvailable) {
          content += "EPUB version is available.\n";
        }
      } else {
        console.log("No preview available for this book. Viewability: " + bookData.accessInfo.viewability);
        content += "\nNo full preview available for this book. Limited content only.\n";
      }
    } else {
      console.log("No accessInfo available in the Google Books API response");
    }
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    
    // Generate sample chunks even if we don't have full content, to ensure users get some response
    // Check if we got meaningful content
    if (content.trim().length > 0) {
      console.log(`Successfully extracted ${content.length} characters of content`);
      
      // Update book with extracted content and preview URL if available
      const updateData: any = {
        status: 'completed',
        summary: summary || content.substring(0, 500)
      };
      
      if (previewAvailable) {
        // Store both URLs to give options for display
        updateData.file_url = previewUrl;
        updateData.embed_url = webReaderLink || previewUrl;
      }
      
      const { error: updateError } = await supabase
        .from('books')
        .update(updateData)
        .eq('id', bookId);
        
      if (updateError) {
        console.error("Error updating book with content:", updateError);
        return { success: false, error: updateError.message };
      }
      
      // Create chunks from the content - make multiple chunks to improve context
      const chunkSize = 1000;
      const chunks = [];
      
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunkText = content.substring(i, i + chunkSize);
        chunks.push({
          book_id: bookId,
          chunk_index: Math.floor(i / chunkSize),
          text: chunkText,
          title: bookData.volumeInfo?.title || "Unknown",
          author: (bookData.volumeInfo?.authors && bookData.volumeInfo.authors.length > 0) 
            ? bookData.volumeInfo.authors.join(", ") 
            : "Unknown",
          summary: summary || chunkText.substring(0, 200)
        });
      }
      
      // Add embedded preview URL as a special chunk if available
      if (previewAvailable && (webReaderLink || previewUrl)) {
        chunks.push({
          book_id: bookId,
          chunk_index: chunks.length,
          text: `This book has a preview available. You can view it at: ${previewUrl}`,
          title: bookData.volumeInfo?.title || "Unknown",
          author: (bookData.volumeInfo?.authors && bookData.volumeInfo.authors.length > 0) 
            ? bookData.volumeInfo.authors.join(", ") 
            : "Unknown",
          summary: "Preview information for the book",
          is_preview_info: true
        });
      }
      
      if (chunks.length > 0) {
        console.log(`Creating ${chunks.length} content chunks for book ${bookId}`);
        
        const { error: chunksError } = await supabase
          .from('book_chunks')
          .insert(chunks);
          
        if (chunksError) {
          console.error("Error creating book chunks:", chunksError);
          return { success: false, error: chunksError.message };
        }
        
        // Update the chunks count in the book record
        const { error: countError } = await supabase
          .from('books')
          .update({ chunks_count: chunks.length })
          .eq('id', bookId);
          
        if (countError) {
          console.error("Error updating chunks count:", countError);
        }
      }
      
      return { 
        success: true, 
        chunksCount: chunks.length,
        previewAvailable: previewAvailable,
        previewUrl: previewAvailable ? previewUrl : null,
        webReaderLink: previewAvailable ? webReaderLink : null
      };
    } else {
      console.log("No content available from Google Books API");
      
      // If no content is available, update the book status
      const { error: updateError } = await supabase
        .from('books')
        .update({
          status: 'no_content_available',
          summary: `No preview text available from Google Books for ID: ${externalId}`
        })
        .eq('id', bookId);
        
      if (updateError) {
        console.error("Error updating book status:", updateError);
      }
      
      return { success: false, error: "No content available from Google Books API" };
    }
  } catch (error) {
    console.error(`Error extracting content: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    return { success: false, error: error.message };
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
    
    // Create a book URL using the Google Books ID - use the preview URL format
    const fileUrl = `https://books.google.com/books?id=${originalBookId}&printsec=frontcover`;
    const previewFileUrl = `https://www.google.com/books/edition/_/${originalBookId}?hl=en&gbpv=1`;

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
          file_url: previewFileUrl, // Using the Google Books preview URL
          status: 'processing', // Set status to a more appropriate value
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
    
    // After successfully adding the book, extract content in the background
    if (data && data.length > 0 && data[0].id) {
      const addedBookId = data[0].id;
      console.log(`Book added successfully with database ID: ${addedBookId}, Google Books ID: ${originalBookId}`);
      
      // Use Edge Runtime waitUntil to run extraction in the background
      EdgeRuntime.waitUntil((async () => {
        const extractionResult = await extractFromGoogleBooks(addedBookId, originalBookId);
        console.log(`Extraction completed with result:`, extractionResult);
      })());
      
      return new Response(
        JSON.stringify({
          success: true,
          message: `Book "${title}" added successfully`,
          bookId: addedBookId,
          title: title,
          extractionTriggered: true,
          status: 'processing',
          note: "Book content extraction is in progress and will be available shortly."
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
