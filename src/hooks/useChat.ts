
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
  const [extractionAttempts, setExtractionAttempts] = useState(0);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const maxExtractionAttempts = 3;

  useEffect(() => {
    const loadBookChunks = async () => {
      if (selectedBookId && !hasAttemptedLoad) {
        setHasAttemptedLoad(true);
        try {
          console.log('Fetching book chunks for:', selectedBookId);
          setError(null);
          const chunks = await fetchBookChunks(selectedBookId);
          
          if (!chunks || chunks.length === 0) {
            console.warn('No chunks found for book ID:', selectedBookId);
            
            if (extractionAttempts < maxExtractionAttempts) {
              setExtractionInProgress(true);
              setExtractionAttempts(prev => prev + 1);
              
              setMessages(prev => [
                ...prev,
                {
                  id: uuidv4(),
                  content: "I'm extracting content from this book. This might take a minute or two for the first question. The system will take screenshots of the book preview and use OCR to extract the text.",
                  type: 'bot',
                  timestamp: new Date(),
                  isSystemMessage: true,
                  isExtractionStatus: true
                }
              ]);
            } else {
              console.error(`Extraction failed after ${maxExtractionAttempts} attempts`);
              setExtractionInProgress(false);
              
              setMessages(prev => [
                ...prev,
                {
                  id: uuidv4(),
                  content: `I was unable to extract text from this book after multiple attempts. The book may not have a preview available on Google Books, or there might be an issue with the extraction process. Please try asking a general question instead.`,
                  type: 'bot',
                  timestamp: new Date(),
                  isSystemMessage: true,
                  isExtractionError: true
                }
              ]);
            }
            
            setBookChunks([]);
          } else {
            console.log(`Loaded ${chunks.length} chunks for book ID: ${selectedBookId}`);
            console.log('Sample chunk:', chunks[0]);
            
            setExtractionInProgress(false);
            setExtractionAttempts(0); // Reset extraction attempts on success
            
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
        setExtractionAttempts(0); // Reset on book change
        setHasAttemptedLoad(false); // Reset when book id changes
      }
    };

    loadBookChunks();
  }, [selectedBookId, selectedBook, extractionAttempts]);

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
            content: "Content extraction is in progress. The system is taking screenshots and processing them with OCR. Your response might be based on partial book content until extraction completes.",
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

      if (response && extractionInProgress && selectedBookId) {
        try {
          const updatedChunks = await fetchBookChunks(selectedBookId);
          if (updatedChunks && updatedChunks.length > 0) {
            console.log(`Now loaded ${updatedChunks.length} chunks after extraction`);
            setBookChunks(updatedChunks);
            setExtractionInProgress(false);
            setExtractionAttempts(0); // Reset on successful extraction
            
            setMessages((prev) => [
              ...prev.filter(msg => !msg.isExtractionComplete),
              {
                id: uuidv4(),
                content: `Content extraction completed successfully. Extracted ${updatedChunks.length} chunks from the book.`,
                type: 'bot',
                timestamp: new Date(),
                isSystemMessage: true,
                isExtractionComplete: true
              }
            ]);
          } else if (extractionAttempts >= maxExtractionAttempts) {
            console.warn(`Still no chunks after ${extractionAttempts} attempts`);
            setExtractionInProgress(false);
            
            setMessages((prev) => [
              ...prev.filter(msg => !msg.isExtractionError),
              {
                id: uuidv4(),
                content: `I was unable to extract text from this book after multiple attempts. The book may not have a preview available, or there might be an issue with the extraction process.`,
                type: 'bot',
                timestamp: new Date(),
                isSystemMessage: true,
                isExtractionError: true
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
