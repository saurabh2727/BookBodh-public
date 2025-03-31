
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
    const timeout = parseInt(url.searchParams.get('timeout') || "5000");
    const additionalPaths = url.searchParams.get('additionalPaths') === 'true';
    
    console.log(`Testing backend API connection to: ${testUrl}${path}`);
    
    // Main test result
    const result = await testEndpoint(testUrl, path, timeout);
    
    // If additional paths parameter is specified, test a variety of API paths
    // This helps diagnose routing issues or different backend deployments
    let additionalResults = {};
    if (additionalPaths) {
      // Common API paths to try
      const commonPaths = [
        "/health",
        "/api/health",
        "/api/test",
        "/api-routes",
        "/api/books",
        "/books",
      ];
      
      // Test all paths in parallel
      const tests = await Promise.all(
        commonPaths.map(async p => {
          try {
            const res = await testEndpoint(testUrl, p, timeout);
            return { path: p, ...res };
          } catch (e) {
            return { path: p, success: false, error: e.message };
          }
        })
      );
      
      // Organize results by path
      additionalResults = tests.reduce((acc, test) => {
        acc[test.path] = test;
        delete test.path;
        return acc;
      }, {});
    }
    
    // Return diagnostic information
    return new Response(
      JSON.stringify({
        success: result.success,
        backend_url: testUrl,
        path: path,
        full_url: `${testUrl}${path}`,
        response_status: result.status,
        content_type: result.contentType,
        response_size: result.responseText?.length || 0,
        is_json: result.isJson,
        response_preview: result.responseText?.substring(0, 500) || null,
        parsed_json: result.isJson ? result.data : null,
        is_html: result.responseText?.includes("<!DOCTYPE html>") || result.responseText?.includes("<html") || false,
        message: result.message,
        additional_paths_tested: additionalPaths ? additionalResults : undefined,
        suggested_backend_url: suggestBackendUrl(result, additionalResults)
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

// Helper function to test a specific endpoint
async function testEndpoint(baseUrl, path, timeout) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      signal: controller.signal,
      headers: { 
        "Accept": "application/json",
        "User-Agent": "Supabase Edge Function Tester/1.0",
        "X-API-Request": "true",
        "X-Backend-Request": "true"
      }
    }).finally(() => clearTimeout(timeoutId));
    
    // Get response details
    const contentType = response.headers.get("content-type");
    const responseText = await response.text();
    
    // Try to parse JSON if appropriate content type
    let data = null;
    let isJson = false;
    
    try {
      if (contentType && contentType.includes("application/json")) {
        data = JSON.parse(responseText);
        isJson = true;
      }
    } catch (e) {
      console.error("Error parsing JSON:", e);
    }
    
    const success = response.status >= 200 && response.status < 300 && isJson;
    
    // Build result message
    let message;
    if (success) {
      message = "Successfully connected to backend API";
    } else if (response.status >= 200 && response.status < 300) {
      message = "Connected to server but received non-JSON response";
    } else {
      message = `Backend returned error status: ${response.status}`;
    }
    
    return {
      success,
      status: response.status,
      contentType,
      responseText,
      isJson,
      data,
      message
    };
  } catch (error) {
    if (error.name === "AbortError") {
      return {
        success: false,
        status: null,
        contentType: null,
        responseText: null,
        isJson: false,
        data: null,
        message: `Connection timed out after ${timeout}ms`
      };
    }
    
    return {
      success: false,
      status: null,
      contentType: null,
      responseText: null,
      isJson: false,
      data: null,
      message: `Connection error: ${error.message}`
    };
  }
}

// Analyze results and suggest a working backend URL
function suggestBackendUrl(mainResult, additionalResults) {
  // If main request succeeded, return that URL
  if (mainResult.success) {
    return null; // No suggestion needed
  }
  
  // If we didn't test additional paths, can't make a suggestion
  if (!additionalResults || Object.keys(additionalResults).length === 0) {
    return null;
  }
  
  // Find any successful test
  for (const [path, result] of Object.entries(additionalResults)) {
    if (result.success) {
      // Extract domain from the successful test
      const urlParts = new URL(result.full_url);
      return urlParts.origin;
    }
  }
  
  return null; // No successful test found
}
