
import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage } from '../types';
import { sendChatRequest, fetchBookChunks } from '@/services/api';

const useChat = (selectedBook: string | null = null, selectedBookId: string | null = null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uuidv4(),
      content: "Hello! I'm BookBodh, your AI assistant. I can help you chat about books or answer general questions.",
      type: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [bookChunks, setBookChunks] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch book chunks when a book ID is selected
  useEffect(() => {
    const loadBookChunks = async () => {
      if (selectedBookId) {
        try {
          console.log('Fetching book chunks for:', selectedBookId);
          setError(null);
          const chunks = await fetchBookChunks(selectedBookId);
          
          if (!chunks || chunks.length === 0) {
            console.warn('No chunks found for book ID:', selectedBookId);
            
            // Add a message about content extraction
            setMessages(prev => [
              ...prev,
              {
                id: uuidv4(),
                content: "I'm extracting content from this book. This might take a minute or two for the first question.",
                type: 'bot',
                timestamp: new Date(),
                isSystemMessage: true
              }
            ]);
            
            // Set a small empty array of chunks - the backend will handle extraction on first query
            setBookChunks([]);
          } else {
            console.log(`Loaded ${chunks.length} chunks for book ID: ${selectedBookId}`);
            console.log('Sample chunk:', chunks[0]);
            
            // When a new book is selected, add a welcome message for that book
            if (messages.length <= 1 || messages[messages.length - 1].type === 'user') {
              setMessages(prev => [
                ...prev.filter(msg => !msg.isBookWelcome), // Remove any previous book welcome messages
                {
                  id: uuidv4(),
                  content: `I'm ready to help you with "${selectedBook}". What would you like to know about this book?`,
                  type: 'bot',
                  timestamp: new Date(),
                  isBookWelcome: true
                }
              ]);
            }
            
            setBookChunks(chunks);
          }
        } catch (error) {
          console.error('Error loading book chunks:', error);
          setError('Failed to load book data. Please try again later.');
        }
      } else {
        // Reset when no book ID is selected
        setBookChunks([]);
      }
    };

    loadBookChunks();
  }, [selectedBookId, selectedBook, messages]);

  const handleSubmit = async (query: string) => {
    if (!query.trim() || isLoading) return;
    
    // Reset any previous errors
    setError(null);

    // Add user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      content: query,
      type: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Add loading message
    const loadingMessageId = uuidv4();
    const loadingMessage: ChatMessage = {
      id: loadingMessageId,
      content: '',
      type: 'bot',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, loadingMessage]);
    setIsLoading(true);

    try {
      // Prepare the request payload with book chunks if book is selected
      const requestPayload = {
        query,
        book: selectedBook,
        bookId: selectedBookId,
        chunks: bookChunks.length > 0 
          ? bookChunks.map(chunk => ({
              title: chunk.title || selectedBook || 'Unknown',
              author: chunk.author || 'Unknown',
              text: chunk.text || '',
              summary: chunk.summary || chunk.text?.substring(0, 200) || ''
            }))
          : undefined
      };

      console.log('Sending chat request with payload:', {
        query: requestPayload.query,
        book: requestPayload.book,
        bookId: requestPayload.bookId,
        chunksCount: requestPayload.chunks?.length
      });
      
      const response = await sendChatRequest(requestPayload);

      // Replace loading message with response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessageId
            ? {
                id: loadingMessageId,
                content: response.response,
                type: 'bot',
                timestamp: new Date(),
                citations: response.book
                  ? [
                      {
                        book: response.book,
                        author: response.author || 'Unknown',
                        page: 1, // Page number not available from current API
                      },
                    ]
                  : undefined,
              }
            : msg
        )
      );
    } catch (error) {
      console.error('Error sending chat request:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message
        : "I'm sorry, I couldn't process your request. Please try again later.";
      
      // Replace loading message with error message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessageId
            ? {
                id: loadingMessageId,
                content: errorMessage,
                type: 'bot',
                timestamp: new Date(),
              }
            : msg
        )
      );
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    isLoading,
    handleSubmit,
    error
  };
};

export default useChat;
