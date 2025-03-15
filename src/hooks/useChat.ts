
import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, ChatRequest } from '@/types';
import { sendChatRequest } from '@/services/api';

type ChatMode = 'general' | 'specific-book';

const useChat = (selectedBook: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uuidv4(),
      content: 'Welcome to BookBodh! How can I assist you today?',
      type: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [chatMode, setChatMode] = useState<ChatMode>('general');

  // Update chat mode when selected book changes
  useEffect(() => {
    if (selectedBook) {
      setChatMode('specific-book');
    }
  }, [selectedBook]);

  const handleSubmit = useCallback(
    async (query: string) => {
      if (!query.trim()) return;

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
      setMessages((prev) => [
        ...prev,
        {
          id: loadingMessageId,
          content: '',
          type: 'bot',
          timestamp: new Date(),
          isLoading: true,
        },
      ]);

      setIsLoading(true);

      try {
        // Prepare request to backend
        const chatRequest: ChatRequest = {
          query,
          book: chatMode === 'specific-book' ? selectedBook : null,
        };

        // Call backend API
        const response = await sendChatRequest(chatRequest);

        // Create citation if book info is available
        const citations = response.book && response.author
          ? [
              {
                book: response.book,
                author: response.author,
                page: 0, // Page info not available from current backend
              },
            ]
          : undefined;

        // Replace loading message with actual response
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessageId
              ? {
                  id: loadingMessageId,
                  content: response.response,
                  type: 'bot',
                  timestamp: new Date(),
                  citations,
                  isLoading: false,
                }
              : msg
          )
        );
      } catch (error) {
        // Replace loading message with error
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessageId
              ? {
                  id: loadingMessageId,
                  content: 'Sorry, I encountered an error while processing your request. Please try again.',
                  type: 'bot',
                  timestamp: new Date(),
                  isLoading: false,
                }
              : msg
          )
        );
        console.error('Chat error:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [chatMode, selectedBook]
  );

  return {
    messages,
    isLoading,
    chatMode,
    setChatMode,
    handleSubmit,
  };
};

export default useChat;
