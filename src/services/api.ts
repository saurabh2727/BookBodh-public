
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
): Promise<{ success: boolean; message: string; bookId?: string; fileUrl?: string }> => {
  try {
    console.log('Uploading book to Supabase Edge Function');
    
    // Get the current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('User not authenticated');
    }
    
    // Create a FormData object
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('author', author);
    formData.append('category', category);
    
    // Call the upload-book edge function
    const { data, error } = await supabase.functions.invoke('upload-book', {
      method: 'POST',
      body: formData,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      console.error('Edge function error:', error);
      throw new Error(error.message || 'Error uploading book');
    }

    console.log('Upload response:', data);
    return data;
  } catch (error) {
    console.error('Book upload error:', error);
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
    
    return data.map(book => ({
      id: book.id,
      title: book.title,
      author: book.author,
      genre: book.category,
      summary: book.summary || '',
      coverColor: getCoverColorByCategory(book.category),
      imageUrl: book.icon_url || undefined,
      fileUrl: book.file_url,
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
    
    console.log(`Fetched ${data.length} chunks`);
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
