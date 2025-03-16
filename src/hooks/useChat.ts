
import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, ChatMode } from '../types';
import { sendChatRequest, fetchBookChunks } from '@/services/api';

interface UseChatProps {
  initialMessages?: ChatMessage[];
  initialMode?: ChatMode;
}

const useChat = (selectedBook: string | null = null, selectedBookId: string | null = null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uuidv4(),
      content: "Hello! I'm BookBodh, your AI assistant. How can I help you today?",
      type: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>('general');
  const [bookChunks, setBookChunks] = useState<any[]>([]);

  // Fetch book chunks when a book ID is selected
  useEffect(() => {
    const loadBookChunks = async () => {
      if (selectedBookId) {
        try {
          const chunks = await fetchBookChunks(selectedBookId);
          setBookChunks(chunks);
          // When chunks are loaded, set mode to specific-book
          setChatMode('specific-book');
        } catch (error) {
          console.error('Error loading book chunks:', error);
        }
      }
    };

    loadBookChunks();
  }, [selectedBookId]);

  const handleSubmit = async (query: string) => {
    if (!query.trim() || isLoading) return;

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
      // Prepare the request payload with book chunks if in specific-book mode
      const requestPayload = {
        query,
        book: selectedBook,
        chunks: chatMode === 'specific-book' && bookChunks.length > 0 
          ? bookChunks.map(chunk => ({
              title: chunk.title,
              author: selectedBook || 'Unknown',
              text: chunk.text
            }))
          : undefined
      };

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
      
      // Replace loading message with error message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessageId
            ? {
                id: loadingMessageId,
                content: "I'm sorry, I couldn't process your request. Please try again later.",
                type: 'bot',
                timestamp: new Date(),
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return {
    messages,
    isLoading,
    chatMode,
    setChatMode,
    handleSubmit,
  };
};

export default useChat;
