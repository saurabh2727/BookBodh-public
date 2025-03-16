
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface DeleteBookRequest {
  bookId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Processing delete book request');
    
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const { bookId } = await req.json() as DeleteBookRequest;

    if (!bookId) {
      return new Response(
        JSON.stringify({ error: 'Book ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Deleting book with ID: ${bookId}`);

    // First, check if the book belongs to the current user
    const { data: bookData, error: bookError } = await supabaseClient
      .from('books')
      .select('file_url, user_id')
      .eq('id', bookId)
      .single();

    if (bookError) {
      console.error('Error fetching book:', bookError);
      return new Response(
        JSON.stringify({ error: `Error fetching book: ${bookError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!bookData) {
      return new Response(
        JSON.stringify({ error: 'Book not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify the book belongs to the user
    if (bookData.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to delete this book' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Delete associated chunks first (to maintain referential integrity)
    const { error: chunksDeleteError } = await supabaseClient
      .from('book_chunks')
      .delete()
      .eq('book_id', bookId);

    if (chunksDeleteError) {
      console.error('Error deleting book chunks:', chunksDeleteError);
      return new Response(
        JSON.stringify({ error: `Error deleting book chunks: ${chunksDeleteError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Delete the book entry
    const { error: bookDeleteError } = await supabaseClient
      .from('books')
      .delete()
      .eq('id', bookId);

    if (bookDeleteError) {
      console.error('Error deleting book record:', bookDeleteError);
      return new Response(
        JSON.stringify({ error: `Error deleting book record: ${bookDeleteError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Delete the file from storage if it exists
    if (bookData.file_url) {
      try {
        // Extract the path from the URL (assuming it's a Supabase storage URL)
        const filePath = new URL(bookData.file_url).pathname.split('/').slice(2).join('/');
        
        if (filePath) {
          const { error: storageDeleteError } = await supabaseClient
            .storage
            .from('books')
            .remove([filePath]);

          if (storageDeleteError) {
            console.error('Error deleting file from storage:', storageDeleteError);
            // Continue even if storage delete fails, as the DB records are already deleted
          }
        }
      } catch (err) {
        console.error('Error processing file deletion from storage:', err);
        // Continue even if storage delete fails
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Book and associated data deleted successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error processing delete book request:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
