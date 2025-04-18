
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
        // First do local extraction which creates initial chunks
        const extractionResult = await extractFromGoogleBooks(addedBookId, originalBookId);
        console.log(`Local extraction completed with result:`, extractionResult);
        
        // Trigger the backend extraction with improved URL patterns and port variations
        try {
          console.log("Triggering backend extraction process for more comprehensive results");
          
          // Get the backend base URLs to try (with different domain patterns and ports)
          const backendBaseUrls = [
            // Standard URL
            Deno.env.get("BACKEND_API_URL") || "https://ethical-wisdom-bot.lovable.app",
            
            // Try specific API subdomains
            "https://api.ethical-wisdom-bot.lovable.app",
            "https://backend.ethical-wisdom-bot.lovable.app",
            
            // Try with different ports (port 8000 is common for FastAPI)
            "https://ethical-wisdom-bot.lovable.app:8000",
            "https://ethical-wisdom-bot.lovable.app:8080",
            
            // Try with different scheme (http instead of https)
            "http://ethical-wisdom-bot.lovable.app",
            
            // Fallback to lovable.app domain if specified domain doesn't work
            "https://ethical-wisdom-bot-api.lovable.app",
            "https://bookbodh-api.lovable.app"
          ];
          
          // Try multiple API path formats to increase chances of success
          const apiPaths = [
            `/api/books/extract-book/${addedBookId}`,
            `/books/extract-book/${addedBookId}`,
            `/api/extract-book/${addedBookId}`,
            `/extract-book/${addedBookId}`,
            `/api/debug-extract/${addedBookId}`,  // Debug endpoint
            `/backend/api/books/extract-book/${addedBookId}`  // Try with /backend prefix
          ];
          
          let extractionSuccess = false;
          let extractionError = null;
          let responseData = null;
          
          // Try each base URL with each API path until one succeeds
          for (const baseUrl of backendBaseUrls) {
            if (extractionSuccess) break;
            
            for (const apiPath of apiPaths) {
              if (extractionSuccess) break;
              
              const backendExtractionUrl = `${baseUrl}${apiPath}`;
              console.log(`Trying backend extraction endpoint: ${backendExtractionUrl}`);
              
              try {
                // Enhanced request with proper headers to help routing
                const backendResponse = await fetch(backendExtractionUrl, {
                  method: "POST",
                  headers: { 
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "Supabase Edge Function/1.0",
                    "X-Request-Source": "edge-function",
                    "X-API-Request": "true",  // Custom header to help identify API requests
                    "X-Backend-Request": "true"  // Another custom header
                  },
                  body: JSON.stringify({ 
                    book_id: addedBookId,
                    external_id: originalBookId,
                    force: true
                  }),
                });
                
                // Log complete response details for debugging
                console.log(`Backend response status: ${backendResponse.status}`);
                const contentType = backendResponse.headers.get("content-type");
                console.log(`Backend response content-type: ${contentType}`);
                
                // Get the full response text
                const responseText = await backendResponse.text();
                console.log(`Backend full response length: ${responseText.length} chars`);
                console.log(`Backend response preview: ${responseText.substring(0, 500)}...`);
                
                // Check if status is success (2xx) AND the content-type is JSON
                if (backendResponse.status >= 200 && backendResponse.status < 300 && 
                    contentType && contentType.includes("application/json")) {
                  try {
                    responseData = JSON.parse(responseText);
                    console.log("Backend extraction JSON response:", responseData);
                    extractionSuccess = true;
                    
                    // Exit both loops on success
                    break;
                  } catch (jsonError) {
                    console.error(`Error parsing JSON response: ${jsonError.message}`);
                    console.error(`Response was: ${responseText.substring(0, 500)}...`);
                    extractionError = `JSON parsing error: ${jsonError.message}`;
                  }
                } else if (backendResponse.status >= 200 && backendResponse.status < 300) {
                  // HTML response with success status - this is NOT considered a success anymore
                  console.error(`Expected JSON but got ${contentType || "unknown content type"}`);
                  console.error(`HTML response with success status code. The extraction process may not be working correctly.`);
                  console.error(`First 500 chars: ${responseText.substring(0, 500)}...`);
                  
                  // If we get HTML, store this error but continue trying other endpoints
                  extractionError = `Backend returned non-JSON response with success status code. Expected application/json.`;
                  
                  // Check if the response is clearly HTML
                  if (responseText.includes("<!DOCTYPE html>") || responseText.includes("<html")) {
                    console.log("Detected HTML response, continuing to try other endpoints");
                    // Continue to next endpoint - don't consider this a success
                    continue;
                  }
                } else {
                  // Error response
                  console.error(`Failed with endpoint ${apiPath}: Status ${backendResponse.status}`);
                  console.error(`Error response: ${responseText.substring(0, 500)}...`);
                  extractionError = `Status ${backendResponse.status} with ${apiPath}`;
                }
              } catch (endpointError) {
                console.error(`Error with endpoint ${apiPath}:`, endpointError);
                console.error(`Full error details: ${endpointError.stack || "No stack trace"}`);
                extractionError = `${endpointError.message} with ${apiPath}`;
              }
            }
          }
          
          // If none of the endpoints worked, log comprehensive error and update book status
          if (!extractionSuccess) {
            console.error("All backend extraction endpoints failed:", extractionError);
            
            // Update book status to indicate extraction issue but with content still available
            await supabase
              .from('books')
              .update({
                status: 'basic_extraction_only',
                summary: `Basic information extracted. Full book preview extraction failed: ${extractionError}`
              })
              .eq('id', addedBookId);
          } else {
            console.log("Backend extraction call succeeded. Book processing should be happening in the background.");
          }
        } catch (backendError) {
          console.error("Error triggering backend extraction:", backendError);
          console.error("Full error details:", backendError.stack || "No stack trace available");
          
          // Update book status to indicate extraction issue
          await supabase
            .from('books')
            .update({
              status: 'basic_extraction_only',
              summary: `Basic information extracted. Full book extraction failed with error: ${backendError.message}`
            })
            .eq('id', addedBookId);
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
    console.error("Stack trace:", error.stack || "No stack trace available");
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
