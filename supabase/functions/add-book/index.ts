
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { v4 as uuidv4 } from "https://esm.sh/uuid@11.0.0";

async function extractFromGoogleBooks(bookId: string, externalId: string) {
  try {
    console.log(`Attempting to extract content for book ${bookId} using Google Books API ID: ${externalId}`);
    
    const googleBooksUrl = `https://www.googleapis.com/books/v1/volumes/${externalId}?fields=volumeInfo(title,authors,description,previewLink,infoLink,subtitle,pageCount),searchInfo,accessInfo(viewability,textToSpeechPermission,pdf,epub,webReaderLink,publicDomain)`;
    console.log(`Calling Google Books API: ${googleBooksUrl}`);
    
    const response = await fetch(googleBooksUrl);
    if (!response.ok) {
      console.error(`Google Books API error: ${response.status} ${response.statusText}`);
      return { success: false, error: `Google Books API error: ${response.status}` };
    }
    
    const bookData = await response.json();
    
    let content = "";
    let summary = "";
    
    if (bookData.volumeInfo?.description) {
      summary = bookData.volumeInfo.description;
      content += "Book Description: " + summary + "\n\n";
    }
    
    if (bookData.searchInfo?.textSnippet) {
      content += "Preview Snippet: " + bookData.searchInfo.textSnippet + "\n\n";
    }
    
    if (bookData.volumeInfo?.preface) {
      content += "Preface: " + bookData.volumeInfo.preface + "\n\n";
    }
    
    if (bookData.volumeInfo?.subtitle) {
      content += "Subtitle: " + bookData.volumeInfo.subtitle + "\n\n";
    }
    
    if (bookData.volumeInfo?.pageCount) {
      content += `Page Count: ${bookData.volumeInfo.pageCount}\n\n`;
    }
    
    let previewAvailable = false;
    let previewUrl = "";
    let webReaderLink = "";
    
    if (bookData.accessInfo) {
      if (bookData.accessInfo.viewability === "PARTIAL" || bookData.accessInfo.viewability === "ALL_PAGES") {
        previewAvailable = true;
        
        if (bookData.accessInfo.webReaderLink) {
          webReaderLink = bookData.accessInfo.webReaderLink;
        }
        
        previewUrl = `https://www.google.com/books/edition/_/${externalId}?hl=en&gbpv=1`;
        
        console.log(`Preview is available for this book at: ${previewUrl}`);
        console.log(`Web reader link: ${webReaderLink}`);
        
        content += `\nA preview of this book is available at: ${previewUrl}\n\n`;
        
        content += `\nEmbed link: ${webReaderLink || previewUrl}\n\n`;
        
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
    
    if (content.trim().length > 0) {
      console.log(`Successfully extracted ${content.length} characters of content`);
      
      const updateData: any = {
        status: 'completed',
        summary: summary || content.substring(0, 500)
      };
      
      if (previewAvailable) {
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
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const { bookId: originalBookId, title, authors, category, previewLink } = await req.json();

    if (!originalBookId || !title || !authors || !category) {
      return new Response(
        JSON.stringify({ error: "Missing required data" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const generatedUuid = uuidv4();
    console.log(`Original Google Books ID: ${originalBookId}, Generated database UUID: ${generatedUuid}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    
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
    
    const token = authHeader.replace("Bearer ", "");
    console.log("Token received, checking user identity...");
    
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
    
    const fileUrl = `https://books.google.com/books?id=${originalBookId}&printsec=frontcover`;
    const previewFileUrl = `https://www.google.com/books/edition/_/${originalBookId}?hl=en&gbpv=1`;

    const { data, error } = await supabase
      .from("books")
      .insert([
        {
          id: generatedUuid,
          title: title,
          author: authors.join(", "),
          category: category,
          icon_url: previewLink,
          file_url: previewFileUrl,
          status: 'processing',
          external_id: originalBookId,
          user_id: userId,
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
    
    if (data && data.length > 0 && data[0].id) {
      const addedBookId = data[0].id;
      console.log(`Book added successfully with database ID: ${addedBookId}, Google Books ID: ${originalBookId}`);
      
      EdgeRuntime.waitUntil((async () => {
        const extractionResult = await extractFromGoogleBooks(addedBookId, originalBookId);
        console.log(`Local extraction completed with result:`, extractionResult);
        
        // Update backend extraction call to use the correct URL format
        try {
          console.log("Triggering backend extraction process for more comprehensive results");
          
          // Get the backend URL from environment or use a default
          const backendUrl = Deno.env.get("BACKEND_API_URL") || "https://ethical-wisdom-bot.lovable.app";
          
          // Correctly format the URL to match the FastAPI endpoint path
          const backendExtractionUrl = `${backendUrl}/books/extract-book/${addedBookId}`;
          
          console.log(`Calling backend extraction endpoint: ${backendExtractionUrl}`);
          
          const backendResponse = await fetch(backendExtractionUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ book_id: addedBookId }),
          });
          
          if (backendResponse.ok) {
            const responseData = await backendResponse.json();
            console.log("Backend extraction process started successfully:", responseData);
          } else {
            const errorText = await backendResponse.text();
            console.error(`Failed to start backend extraction process: Status ${backendResponse.status}`, errorText);
          }
        } catch (backendError) {
          console.error("Error triggering backend extraction:", backendError);
        }
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
