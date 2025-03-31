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
    let requestBody = {};
    
    try {
      // Try to parse request body if present
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const text = await req.text();
        if (text) {
          requestBody = JSON.parse(text);
        }
      }
    } catch (e) {
      console.error("Error parsing request body:", e);
    }
    
    // Get parameters from URL or request body
    const body = requestBody as Record<string, any>;
    const testUrl = body.url || url.searchParams.get('url') || Deno.env.get("BACKEND_API_URL") || "http://localhost:8000";
    const path = body.path || url.searchParams.get('path') || "/api/health";
    const timeout = parseInt(body.timeout || url.searchParams.get('timeout') || "5000");
    const additionalPaths = body.additionalPaths || url.searchParams.get('additionalPaths') === 'true';
    const debug = body.debug || url.searchParams.get('debug') === 'true';
    
    console.log(`Testing backend API connection to: ${testUrl}${path}`);
    
    // Add common API paths to try
    const commonPaths = [
      "/health",
      "/api/health",
      "/api/test",
      "/api-routes",
      "/api/books",
      "/books",
    ];
    
    // Add common backend URL patterns to try
    const urlVariations = [
      testUrl,
      // Try different ports
      testUrl.replace(':8000', ':8080'),
      testUrl.replace(':8080', ':8000'),
      // Try with and without trailing slash
      testUrl.endsWith('/') ? testUrl.slice(0, -1) : testUrl + '/',
      // Try adding or removing 'api' in path
      testUrl.includes('/api') ? testUrl.replace('/api', '') : testUrl + '/api',
    ];
    
    // Filter out duplicates
    const uniqueUrls = [...new Set(urlVariations)];
    
    // Prepare debug info
    const debugInfo = {
      request_headers: debug ? Object.fromEntries([...req.headers.entries()]) : undefined,
      routing_info: debug ? `Request path: ${url.pathname}, Testing: ${testUrl}${path}` : undefined,
      attempted_urls: uniqueUrls.map(u => `${u}${path}`),
    };
    
    // Test the primary URL first
    const result = await testEndpoint(testUrl, path, timeout, debug);
    
    // If successful, return immediately
    if (result.success) {
      return new Response(
        JSON.stringify({
          ...result,
          debug_info: debugInfo,
          full_url: `${testUrl}${path}`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // If main test failed, try additional URLs and paths
    let additionalResults = {};
    let bestResult = result;
    let successfulUrl = null;
    
    // Try all URL variations with the primary path
    for (const urlVariation of uniqueUrls) {
      if (urlVariation !== testUrl) { // Skip the one we already tested
        const variationResult = await testEndpoint(urlVariation, path, timeout, debug);
        if (variationResult.success) {
          successfulUrl = urlVariation;
          bestResult = variationResult;
          bestResult.backend_url = urlVariation; // Update the backend_url field
          break; // Found a working URL, stop testing
        }
      }
    }
    
    // If still no success and additional paths are requested, try different paths
    if (!successfulUrl && additionalPaths) {
      // Test all paths for all URL variations
      for (const urlVariation of uniqueUrls) {
        for (const testPath of commonPaths) {
          if (testPath !== path) { // Skip the path we already tested
            const pathResult = await testEndpoint(urlVariation, testPath, timeout, debug);
            
            // Add to additional results
            additionalResults[`${urlVariation}${testPath}`] = pathResult;
            
            // If this one worked, keep track of it
            if (pathResult.success && !successfulUrl) {
              successfulUrl = urlVariation;
              bestResult = pathResult;
              bestResult.backend_url = urlVariation;
              bestResult.path = testPath;
            }
          }
        }
      }
    }
    
    // Check if we found a working combination
    const suggestedUrl = successfulUrl || suggestBackendUrl(result, additionalResults);
    
    // Return the best result (either failure or success from alternative URL)
    return new Response(
      JSON.stringify({
        ...bestResult,
        full_url: `${bestResult.backend_url}${bestResult.path || path}`,
        additional_paths_tested: additionalPaths ? additionalResults : undefined,
        suggested_backend_url: suggestedUrl,
        debug_info: debugInfo
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
async function testEndpoint(baseUrl, path, timeout, debug = false) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Special headers to help distinguish between frontend and backend
    const headers = { 
      "Accept": "application/json",
      "User-Agent": "Supabase Edge Function Tester/1.0",
      "X-API-Request": "true",
      "X-Backend-Request": "true",
      "X-API-Test": "true"
    };
    
    // Log request details if debug is enabled
    if (debug) {
      console.log(`Testing endpoint: ${baseUrl}${path}`, headers);
    }
    
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      signal: controller.signal,
      headers
    }).finally(() => clearTimeout(timeoutId));
    
    // Get response details
    const contentType = response.headers.get("content-type");
    const responseText = await response.text();
    
    // Try to parse JSON if appropriate content type
    let data = null;
    let isJson = false;
    
    try {
      if (contentType && contentType.includes("application/json") || 
          (responseText.trim().startsWith('{') && responseText.trim().endsWith('}'))) {
        data = JSON.parse(responseText);
        isJson = true;
      }
    } catch (e) {
      console.error("Error parsing JSON:", e);
    }
    
    const isHtml = responseText.includes("<!DOCTYPE html>") || 
                  responseText.includes("<html") || 
                  contentType?.includes("text/html");
                  
    const success = response.status >= 200 && response.status < 300 && isJson;
    
    // Extract server information if available
    let serverInfo = {};
    try {
      if (data && (data.version || data.api_name || data.status === "healthy")) {
        serverInfo = {
          version: data.version,
          api_name: data.api_name || "BookBodh API",
          environment: data.environment || "unknown"
        };
      }
    } catch (e) {
      console.error("Error extracting server info:", e);
    }
    
    // Build result message
    let message;
    if (success) {
      message = "Successfully connected to backend API";
    } else if (response.status >= 200 && response.status < 300) {
      message = isHtml 
        ? "Connected to server but received HTML instead of JSON (likely hit frontend application)"
        : "Connected to server but received non-JSON response";
    } else {
      message = `Backend returned error status: ${response.status}`;
    }
    
    return {
      success,
      status: response.status,
      contentType,
      responseText: responseText.substring(0, 1000), // Limit preview size
      isJson,
      is_html: isHtml,
      data,
      message,
      response_preview: responseText.substring(0, 500) || null,
      response_size: responseText?.length || 0,
      parsed_json: isJson ? data : null,
      backend_url: baseUrl,
      path: path,
      server_info: Object.keys(serverInfo).length > 0 ? serverInfo : undefined
    };
  } catch (error) {
    if (error.name === "AbortError") {
      return {
        success: false,
        status: null,
        contentType: null,
        responseText: null,
        isJson: false,
        is_html: false,
        data: null,
        message: `Connection timed out after ${timeout}ms`,
        backend_url: baseUrl,
        path: path
      };
    }
    
    return {
      success: false,
      status: null,
      contentType: null,
      responseText: null,
      isJson: false,
      is_html: false,
      data: null,
      message: `Connection error: ${error.message}`,
      backend_url: baseUrl,
      path: path
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
  for (const [url, result] of Object.entries(additionalResults)) {
    if (result.success) {
      // Extract domain from the successful test
      try {
        const urlParts = new URL(url);
        return urlParts.origin;
      } catch (e) {
        console.error("Error parsing URL:", e);
      }
    }
  }
  
  return null; // No successful test found
}
