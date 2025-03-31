
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Extract parameters from request
    const url = new URL(req.url);
    const testUrl = url.searchParams.get('url') || Deno.env.get("BACKEND_API_URL") || "https://ethical-wisdom-bot.lovable.app";
    const path = url.searchParams.get('path') || "/api/health";
    
    console.log(`Testing backend API connection to: ${testUrl}${path}`);
    
    // Attempt to connect to the backend API
    const apiResponse = await fetch(`${testUrl}${path}`, {
      method: "GET",
      headers: { 
        "Accept": "application/json",
        "User-Agent": "Supabase Edge Function Tester/1.0",
        "X-API-Request": "true",
        "X-Backend-Request": "true"
      }
    });
    
    // Log response details
    console.log(`Response status: ${apiResponse.status}`);
    const contentType = apiResponse.headers.get("content-type");
    console.log(`Response content-type: ${contentType}`);
    
    // Get the full response
    const responseText = await apiResponse.text();
    let responseData;
    let isJson = false;
    
    try {
      if (contentType && contentType.includes("application/json")) {
        responseData = JSON.parse(responseText);
        isJson = true;
      }
    } catch (e) {
      console.error("Error parsing JSON:", e);
    }
    
    // Return diagnostic information
    return new Response(
      JSON.stringify({
        success: apiResponse.status >= 200 && apiResponse.status < 300,
        backend_url: testUrl,
        path: path,
        full_url: `${testUrl}${path}`,
        response_status: apiResponse.status,
        content_type: contentType,
        response_size: responseText.length,
        is_json: isJson,
        response_preview: responseText.substring(0, 500),
        parsed_json: isJson ? responseData : null,
        is_html: responseText.includes("<!DOCTYPE html>") || responseText.includes("<html"),
        message: isJson ? "Successfully connected to backend API" : 
                 "Connected to server but received non-JSON response"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error testing backend API:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
