import { ChatRequest, ChatResponse, Book } from '../types';
import { supabase, getAuthHeader } from '@/lib/supabase';

/**
 * Sends a chat request to the Supabase Edge Function
 * @param request The chat request with query and optional book/bookId
 * @returns Promise with the chat response
 */
export const sendChatRequest = async (request: ChatRequest): Promise<ChatResponse> => {
  try {
    console.log('Sending chat request to Supabase Edge Function');
    console.log('Request payload:', JSON.stringify(request));
    
    // Get the auth header
    const authHeader = await getAuthHeader();
    
    if (!authHeader) {
      throw new Error('User not authenticated');
    }
    
    console.log('Got auth header, token length:', authHeader.length);
    
    try {
      const { data, error } = await supabase.functions.invoke('chat-response', {
        method: 'POST',
        body: request,
        headers: {
          Authorization: authHeader,
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
    
    // Get the auth header using the exported function from lib/supabase
    const authHeader = await getAuthHeader();
    
    if (!authHeader) {
      console.error('No authorization header available');
      return { 
        success: false, 
        message: 'User not authenticated. Please log in again.' 
      };
    }
    
    console.log('Auth header obtained, length:', authHeader.length);
    
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
      // Call the Edge Function with the auth header
      const { data, error: invokeError } = await supabase.functions.invoke('upload-book', {
        body: formData,
        method: 'POST',
        headers: {
          Authorization: authHeader
        }
      });
      
      if (invokeError) {
        console.error('Edge Function invoke error:', invokeError);
        return {
          success: false,
          message: `Upload error: ${invokeError.message || 'Unknown edge function error'}`
        };
      }
      
      console.log('Edge Function response:', data);
      
      if (!data.success) {
        return {
          success: false,
          message: data.error || 'Upload failed on server'
        };
      }
      
      return {
        success: true,
        message: data.message || `Book "${title}" uploaded successfully`,
        bookId: data.bookId,
        chunksCount: data.chunksCount,
        fileUrl: data.fileUrl
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
