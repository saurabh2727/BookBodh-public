
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
  const [extractionInProgress, setExtractionInProgress] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [bookStatus, setBookStatus] = useState<string | null>(null);
  const extractionPollingInterval = 5000; // Poll every 5 seconds for extraction status

  useEffect(() => {
    let pollingTimer: number | null = null;

    const loadBookChunks = async () => {
      if (selectedBookId && !hasAttemptedLoad) {
        setHasAttemptedLoad(true);
        try {
          console.log('Fetching book chunks for:', selectedBookId);
          setError(null);
          const chunks = await fetchBookChunks(selectedBookId);
          
          if (!chunks || chunks.length === 0) {
            console.warn('No chunks found for book ID:', selectedBookId);
            
            // Check if extraction is in progress rather than triggering a new one
            setExtractionInProgress(true);
            
            setMessages(prev => [
              ...prev,
              {
                id: uuidv4(),
                content: "I'm waiting for this book's content to be processed. This might take a minute or two. Please wait while the content is being extracted.",
                type: 'bot',
                timestamp: new Date(),
                isSystemMessage: true,
                isExtractionStatus: true
              }
            ]);
            
            // Start polling for updates
            if (!pollingTimer) {
              pollingTimer = window.setInterval(async () => {
                console.log('Polling for book chunks...');
                try {
                  const updatedChunks = await fetchBookChunks(selectedBookId);
                  if (updatedChunks && updatedChunks.length > 0) {
                    console.log(`Found ${updatedChunks.length} chunks on polling`);
                    setBookChunks(updatedChunks);
                    setExtractionInProgress(false);
                    window.clearInterval(pollingTimer!);
                    pollingTimer = null;
                    
                    setMessages(prev => [
                      ...prev.filter(msg => !msg.isExtractionComplete && !msg.isExtractionStatus),
                      {
                        id: uuidv4(),
                        content: `Book content has been processed successfully. I'm ready to answer your questions about "${selectedBook}".`,
                        type: 'bot',
                        timestamp: new Date(),
                        isSystemMessage: true,
                        isExtractionComplete: true,
                        isBookWelcome: true
                      }
                    ]);
                  }
                } catch (err) {
                  console.error('Error polling for book chunks:', err);
                }
              }, extractionPollingInterval);
            }
            
            setBookChunks([]);
          } else {
            console.log(`Loaded ${chunks.length} chunks for book ID: ${selectedBookId}`);
            console.log('Sample chunk:', chunks[0]);
            
            setExtractionInProgress(false);
            
            if (messages.length <= 1 || messages[messages.length - 1].type === 'user') {
              setMessages(prev => [
                ...prev.filter(msg => !msg.isBookWelcome),
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
          
          // Display error to user if extraction was in progress
          if (extractionInProgress) {
            setMessages(prev => [
              ...prev,
              {
                id: uuidv4(),
                content: `There was an error loading the book content: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again later or select a different book.`,
                type: 'bot',
                timestamp: new Date(),
                isSystemMessage: true,
                isExtractionError: true
              }
            ]);
            setExtractionInProgress(false);
          }
        }
      } else if (!selectedBookId) {
        setBookChunks([]);
        setExtractionInProgress(false);
        setHasAttemptedLoad(false); // Reset when book id changes
        
        // Clear the polling timer if it exists
        if (pollingTimer) {
          window.clearInterval(pollingTimer);
          pollingTimer = null;
        }
      }
    };

    loadBookChunks();

    // Clean up polling timer on unmount
    return () => {
      if (pollingTimer) {
        window.clearInterval(pollingTimer);
      }
    };
  }, [selectedBookId, selectedBook, messages]);

  // Reset attempted load state when book changes
  useEffect(() => {
    setHasAttemptedLoad(false);
  }, [selectedBookId]);

  const handleSubmit = async (query: string) => {
    if (!query.trim() || isLoading) return;
    
    setError(null);

    const userMessage: ChatMessage = {
      id: uuidv4(),
      content: query,
      type: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

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
      if (extractionInProgress && selectedBookId) {
        const extractionMessageId = uuidv4();
        setMessages((prev) => [
          ...prev.filter(msg => !msg.isExtractionStatus),
          {
            id: extractionMessageId,
            content: "The book's content is still being processed. I'll do my best to answer your question based on general knowledge, but I might not have specific details from the book yet.",
            type: 'bot',
            timestamp: new Date(),
            isSystemMessage: true,
            isExtractionStatus: true
          }
        ]);
      }
      
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

      // If we're still polling for extraction results, check for new chunks
      if (extractionInProgress && selectedBookId) {
        try {
          console.log('Checking for newly extracted chunks');
          
          const updatedChunks = await fetchBookChunks(selectedBookId);
          if (updatedChunks && updatedChunks.length > 0) {
            console.log(`Now loaded ${updatedChunks.length} chunks after checking`);
            setBookChunks(updatedChunks);
            setExtractionInProgress(false);
            
            setMessages((prev) => [
              ...prev.filter(msg => !msg.isExtractionComplete),
              {
                id: uuidv4(),
                content: `Content extraction completed successfully. I can now answer questions about the book in detail.`,
                type: 'bot',
                timestamp: new Date(),
                isSystemMessage: true,
                isExtractionComplete: true
              }
            ]);
          }
        } catch (chunkError) {
          console.error('Error checking for updated chunks:', chunkError);
        }
      }

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
                        page: 1,
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
    error,
    extractionInProgress
  };
};

export default useChat;
