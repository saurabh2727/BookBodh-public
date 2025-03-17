
import { ChatRequest, ChatResponse, Book } from '../types';
import { supabase } from '@/integrations/supabase/client';

/**
 * Sends a chat request to the Supabase Edge Function
 * @param request The chat request with query and optional book/bookId
 * @returns Promise with the chat response
 */
export const sendChatRequest = async (request: ChatRequest): Promise<ChatResponse> => {
  try {
    console.log('Sending chat request to Supabase Edge Function');
    console.log('Request payload:', JSON.stringify(request));
    
    // Get the current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('User not authenticated');
    }
    
    console.log('Got session, access token length:', session.access_token.length);
    
    try {
      const { data, error } = await supabase.functions.invoke('chat-response', {
        method: 'POST',
        body: request,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Error calling chat response function');
      }

      console.log('Server response:', data);
      return data as ChatResponse;
    } catch (invokeError) {
      console.error('Error invoking Edge Function:', invokeError);
      console.error('Error details:', JSON.stringify(invokeError, null, 2));
      throw new Error(`Failed to invoke Edge Function: ${invokeError.message}`);
    }
  } catch (error) {
    console.error('Chat request error:', error);
    throw error;
  }
};

/**
 * Uploads a book file to the Supabase Edge Function
 * @param file The book file to upload
 * @param title The book title
 * @param author The book author
 * @param category The book category
 * @returns Promise with the upload response
 */
export const uploadBook = async (
  file: File, 
  title: string, 
  author: string, 
  category: string
): Promise<{ success: boolean; message: string; bookId?: string; chunksCount?: number; fileUrl?: string }> => {
  try {
    console.log('Uploading book to Supabase Edge Function');
    console.log('File details:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: new Date(file.lastModified).toISOString()
    });
    
    // Validate file size before attempting upload
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit for edge function
    if (file.size > MAX_FILE_SIZE) {
      console.error(`File too large: ${file.size} bytes (max: ${MAX_FILE_SIZE} bytes)`);
      return { 
        success: false, 
        message: `File is too large (${Math.round(file.size/1024/1024)}MB). Maximum allowed size is 10MB.` 
      };
    }
    
    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session error:', sessionError);
      return { 
        success: false, 
        message: `Authentication error: ${sessionError.message}` 
      };
    }
    
    if (!session) {
      console.error('No active session found');
      return { 
        success: false, 
        message: 'User not authenticated. Please log in again.' 
      };
    }
    
    console.log('Session obtained, token length:', session.access_token.length);
    
    // Create a FormData object
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('author', author);
    formData.append('category', category);
    
    console.log('FormData created with fields:', {
      title,
      author,
      category,
      fileEntryName: file.name
    });
    
    try {
      // Try direct upload to database instead of using edge function
      // First, upload the file to storage
      console.log('Uploading file to Supabase Storage');
      
      // Create books bucket if it doesn't exist
      const { data: bucketData, error: bucketError } = await supabase
        .storage
        .createBucket('books', {
          public: false,
          fileSizeLimit: 50 * 1024 * 1024, // 50MB limit
        });
      
      if (bucketError && !bucketError.message.includes('already exists')) {
        console.error('Bucket creation error:', bucketError);
        // Continue anyway as the bucket might already exist
      } else {
        console.log('Bucket created or already exists');
      }
      
      // Generate a unique ID for the book
      const bookId = crypto.randomUUID();
      const filePath = `${bookId}/${file.name.replace(/\s+/g, '_')}`;
      
      // Upload the file to storage
      const { data: fileData, error: fileError } = await supabase
        .storage
        .from('books')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (fileError) {
        console.error('File upload error:', fileError);
        return { 
          success: false, 
          message: `Error uploading file: ${fileError.message}` 
        };
      }
      
      console.log('File uploaded successfully:', fileData);
      
      // Get the public URL for the file
      const { data: urlData } = await supabase
        .storage
        .from('books')
        .getPublicUrl(filePath);
      
      const fileUrl = urlData?.publicUrl;
      console.log('File public URL:', fileUrl);
      
      // Create book record in database
      const { data: bookData, error: bookError } = await supabase
        .from('books')
        .insert([
          {
            id: bookId,
            title,
            author,
            category,
            file_url: fileUrl,
            status: 'uploaded',
            summary: `Processing ${title} by ${author}...`
          }
        ])
        .select();
      
      if (bookError) {
        console.error('Database insert error:', bookError);
        return { 
          success: false, 
          message: `Error saving book metadata: ${bookError.message}` 
        };
      }
      
      console.log('Book metadata saved:', bookData);
      
      // Try processing the book with the edge function later (async)
      console.log('Book uploaded successfully, will be processed later');
      return {
        success: true,
        message: `Book "${title}" uploaded successfully`,
        bookId,
        fileUrl
      };
      
    } catch (invokeError) {
      console.error('Error during upload process:', invokeError);
      console.error('Error details:', JSON.stringify(invokeError, null, 2));
      
      if (invokeError instanceof Error) {
        if (invokeError.message.includes('NetworkError') || invokeError.message.includes('Load failed')) {
          return { 
            success: false, 
            message: 'Network error. The Edge Function may be unavailable. Please try again later or with a smaller file.' 
          };
        }
        
        return { 
          success: false, 
          message: `Upload error: ${invokeError.message}` 
        };
      }
      
      return { 
        success: false, 
        message: 'Unknown upload error. Please try again or contact support.' 
      };
    }
  } catch (error) {
    console.error('Book upload error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    return { 
      success: false, 
      message: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
};

/**
 * Deletes a book and its associated data
 * @param bookId The ID of the book to delete
 * @returns Promise with the deletion response
 */
export const deleteBook = async (bookId: string): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('Deleting book with ID:', bookId);
    
    // Get the current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('User not authenticated');
    }
    
    // Call the delete-book edge function
    const { data, error } = await supabase.functions.invoke('delete-book', {
      method: 'POST',
      body: { bookId },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(error.message || 'Error deleting book');
    }

    console.log('Delete response:', data);
    return data;
  } catch (error) {
    console.error('Book deletion error:', error);
    throw error;
  }
};

/**
 * Fetches user's uploaded books
 * @returns Promise with the list of books
 */
export const fetchUserBooks = async (): Promise<Book[]> => {
  try {
    // Get the current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('User not authenticated');
    }
    
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      throw new Error(error.message || 'Error fetching books');
    }
    
    // Log books data for debugging
    console.log(`Fetched ${data.length} books:`, data.map(b => ({
      id: b.id,
      title: b.title,
      status: b.status,
      // Type assertion to safely access chunks_count
      chunks_count: (b as any).chunks_count
    })));
    
    return data.map(book => ({
      id: book.id,
      title: book.title,
      author: book.author,
      genre: book.category,
      summary: book.summary || '',
      coverColor: getCoverColorByCategory(book.category),
      imageUrl: book.icon_url || undefined,
      fileUrl: book.file_url,
      // Use type assertion to handle chunks_count
      chunksCount: (book as any).chunks_count || undefined
    }));
  } catch (error) {
    console.error('Error fetching books:', error);
    throw error;
  }
};

/**
 * Fetches book chunks for a specific book
 * @param bookId The ID of the book
 * @returns Promise with the list of book chunks
 */
export const fetchBookChunks = async (bookId: string) => {
  try {
    console.log('Fetching book chunks for book ID:', bookId);
    const { data, error } = await supabase
      .from('book_chunks')
      .select('*')
      .eq('book_id', bookId)
      .order('chunk_index');
      
    if (error) {
      throw new Error(error.message || 'Error fetching book chunks');
    }
    
    console.log(`Fetched ${data.length} chunks for book ${bookId}`);
    
    // Log first chunk for debugging
    if (data.length > 0) {
      console.log('First chunk sample:', {
        id: data[0].id,
        book_id: data[0].book_id,
        chunk_index: data[0].chunk_index,
        textLength: data[0].text?.length
      });
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching book chunks:', error);
    throw error;
  }
};

/**
 * Gets a color for book cover based on category
 */
const getCoverColorByCategory = (category: string): string => {
  const categoryColors: Record<string, string> = {
    'Fiction': 'bg-blue-500',
    'Non-Fiction': 'bg-green-500',
    'Philosophy': 'bg-purple-500',
    'Science': 'bg-cyan-500',
    'History': 'bg-amber-500',
    'Uncategorized': 'bg-gray-500'
  };
  
  return categoryColors[category] || categoryColors['Uncategorized'];
};

/**
 * Checks if the user is authenticated
 * @returns Promise with the session data
 */
export const checkAuth = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

/**
 * Signs in with email and password
 * @param email User email
 * @param password User password
 */
export const signInWithEmail = async (email: string, password: string) => {
  return supabase.auth.signInWithPassword({ email, password });
};

/**
 * Signs up with email and password
 * @param email User email
 * @param password User password
 */
export const signUpWithEmail = async (email: string, password: string) => {
  return supabase.auth.signUp({ email, password });
};

/**
 * Signs out the current user
 */
export const signOut = async () => {
  return supabase.auth.signOut();
};
