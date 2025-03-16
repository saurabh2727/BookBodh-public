
// Follow this setup locally:
// 1. Run `npx supabase start` (after installing supabase-js SDK)
// 2. Run `npx supabase functions serve upload-book`

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Create a Supabase client with Admin privileges for file operations
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a Supabase client with the user's JWT
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is a multipart form data request
    const contentType = req.headers.get('content-type') || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Expected multipart/form-data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the form data
    const formData = await req.formData();
    const file = formData.get('file');
    
    if (!file || !(file instanceof File)) {
      return new Response(
        JSON.stringify({ success: false, error: 'No file found in request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type (PDF only)
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Only PDF files are allowed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a unique filename
    const uniqueFilename = `${user.id}-${Date.now()}-${file.name}`;
    
    // Ensure the books bucket exists (create it if it doesn't)
    const { data: buckets } = await adminClient.storage.listBuckets();
    const booksBucketExists = buckets?.some(bucket => bucket.name === 'books');
    
    if (!booksBucketExists) {
      await adminClient.storage.createBucket('books', {
        public: false, // Keep files private
      });
      
      // Set up RLS policy to allow authenticated users to access their own files
      await adminClient.storage.from('books').createPolicy('books_policy', {
        name: 'Only the owner can access their files',
        definition: "((storage.foldername(name))[1] = auth.uid())",
        allow: 'insert,update,select,delete',
        identities: ['authenticated'],
      });
    }

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Upload the file to Supabase Storage
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from('books')
      .upload(`${user.id}/${uniqueFilename}`, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return new Response(
        JSON.stringify({ success: false, error: `Error uploading file: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate URL for the uploaded file
    const { data: urlData } = await adminClient.storage
      .from('books')
      .createSignedUrl(`${user.id}/${uniqueFilename}`, 60 * 60 * 24 * 7); // 7 days expiry

    // Extract text from the PDF (simplified - in production, this would be a more complex process)
    // For now, we'll just return success with the file URL
    return new Response(
      JSON.stringify({
        success: true,
        message: `Book '${file.name}' uploaded successfully`,
        filename: uniqueFilename,
        fileUrl: urlData?.signedUrl || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing upload:', error);
    return new Response(
      JSON.stringify({ success: false, error: `Server error: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
