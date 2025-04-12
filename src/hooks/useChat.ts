
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
  const maxExtractionAttempts = 10; // Increased to 10 attempts (50 seconds total)
  const [extractionAttempts, setExtractionAttempts] = useState(0);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  // Effect to handle book selection and chunk loading
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
            
            setExtractionInProgress(true);
            setExtractionAttempts(0);
            
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
            
            if (!pollingTimer) {
              pollingTimer = window.setInterval(async () => {
                console.log('Polling for book chunks...');
                try {
                  setExtractionAttempts(prev => prev + 1);
                  
                  const updatedChunks = await fetchBookChunks(selectedBookId);
                  if (updatedChunks && updatedChunks.length > 0) {
                    console.log(`Found ${updatedChunks.length} chunks on polling`);
                    setBookChunks(updatedChunks);
                    setExtractionInProgress(false);
                    window.clearInterval(pollingTimer!);
                    pollingTimer = null;
                    
                    // Make sure we have a book title to display
                    const bookTitle = selectedBook || 
                      (updatedChunks[0]?.title) || 
                      'this book';
                    
                    // Check if we can find an embed URL for Google Books
                    const bookEmbedUrl = extractGoogleBooksEmbedUrl(updatedChunks);
                    if (bookEmbedUrl) {
                      setEmbedUrl(bookEmbedUrl);
                      console.log('Found Google Books embed URL:', bookEmbedUrl);
                    }
                    
                    setMessages(prev => [
                      ...prev.filter(msg => !msg.isExtractionComplete && !msg.isExtractionStatus),
                      {
                        id: uuidv4(),
                        content: `Book content has been processed successfully. I'm ready to answer your questions about "${bookTitle}".`,
                        type: 'bot',
                        timestamp: new Date(),
                        isSystemMessage: true,
                        isExtractionComplete: true,
                        isBookWelcome: true,
                        embedUrl: bookEmbedUrl
                      }
                    ]);
                  } else if (extractionAttempts >= maxExtractionAttempts) {
                    window.clearInterval(pollingTimer!);
                    pollingTimer = null;
                    setExtractionInProgress(false);
                    
                    setMessages(prev => [
                      ...prev.filter(msg => !msg.isExtractionStatus),
                      {
                        id: uuidv4(),
                        content: "The book's content extraction is taking longer than expected. I'll do my best to answer your questions based on general knowledge. You can still chat about this book, and I'll try to help as much as I can.",
                        type: 'bot',
                        timestamp: new Date(),
                        isSystemMessage: true,
                        isExtractionStatus: true
                      }
                    ]);
                  }
                } catch (err) {
                  console.error('Error polling for book chunks:', err);
                  
                  if (extractionAttempts >= maxExtractionAttempts) {
                    window.clearInterval(pollingTimer!);
                    pollingTimer = null;
                    setExtractionInProgress(false);
                    
                    setMessages(prev => [
                      ...prev.filter(msg => !msg.isExtractionStatus),
                      {
                        id: uuidv4(),
                        content: "I wasn't able to retrieve the book's content. I'll do my best to answer your questions based on general knowledge. You can still chat about this book, and I'll try to help as much as I can.",
                        type: 'bot',
                        timestamp: new Date(),
                        isSystemMessage: true,
                        isExtractionStatus: true
                      }
                    ]);
                  }
                }
              }, extractionPollingInterval);
            }
            
            setBookChunks([]);
          } else {
            console.log(`Loaded ${chunks.length} chunks for book ID: ${selectedBookId}`);
            console.log('Sample chunk:', chunks[0]);
            
            setExtractionInProgress(false);
            
            // Make sure we have a book title to display
            const bookTitle = selectedBook || (chunks[0]?.title) || 'this book';
            
            // Check if we can find an embed URL for Google Books
            const bookEmbedUrl = extractGoogleBooksEmbedUrl(chunks);
            if (bookEmbedUrl) {
              setEmbedUrl(bookEmbedUrl);
              console.log('Found Google Books embed URL:', bookEmbedUrl);
            }
            
            if (messages.length <= 1 || messages[messages.length - 1].type === 'user') {
              setMessages(prev => [
                ...prev.filter(msg => !msg.isBookWelcome),
                {
                  id: uuidv4(),
                  content: `I'm ready to help you with "${bookTitle}". What would you like to know about this book?`,
                  type: 'bot',
                  timestamp: new Date(),
                  isBookWelcome: true,
                  embedUrl: bookEmbedUrl
                }
              ]);
            }
            
            setBookChunks(chunks);
          }
        } catch (error) {
          console.error('Error loading book chunks:', error);
          setError('Failed to load book data. Please try again later.');
          
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
        setHasAttemptedLoad(false);
        setExtractionAttempts(0);
        setEmbedUrl(null);
        
        if (pollingTimer) {
          window.clearInterval(pollingTimer);
          pollingTimer = null;
        }
      }
    };

    loadBookChunks();

    return () => {
      if (pollingTimer) {
        window.clearInterval(pollingTimer);
      }
    };
  }, [selectedBookId, selectedBook, messages, extractionAttempts, maxExtractionAttempts]);

  // Reset hasAttemptedLoad when book changes
  useEffect(() => {
    setHasAttemptedLoad(false);
    setExtractionAttempts(0);
  }, [selectedBookId]);

  // Extract Google Books embed URL from chunks
  const extractGoogleBooksEmbedUrl = (chunks: any[]): string | null => {
    if (!chunks || chunks.length === 0) return null;
    
    // First check if any chunks have a Google Books ID or external_id
    for (const chunk of chunks) {
      // Check for direct embed URL in the chunk
      if (chunk.embed_url) return chunk.embed_url;
      
      // Check if the text contains a Google Books URL
      const text = chunk.text || '';
      const bookIdMatch = text.match(/books\.google\.com\/books\?id=([^&]+)/);
      if (bookIdMatch && bookIdMatch[1]) {
        return `https://books.google.com/books?id=${bookIdMatch[1]}&lpg=PP1&pg=PP1&output=embed`;
      }
      
      // Check external_id if available
      if (chunk.external_id && chunk.external_id.length > 5) {
        return `https://books.google.com/books?id=${chunk.external_id}&lpg=PP1&pg=PP1&output=embed`;
      }
    }
    
    // Look for a book ID in the book_id field if it might be a Google Books ID
    // Usually Google Books IDs are 12 characters, mixed case and may include hyphens
    const possibleGoogleId = chunks[0].book_id;
    if (possibleGoogleId && 
        possibleGoogleId.length >= 10 && 
        possibleGoogleId.length <= 15 && 
        /^[a-zA-Z0-9_-]+$/.test(possibleGoogleId)) {
      return `https://books.google.com/books?id=${possibleGoogleId}&lpg=PP1&pg=PP1&output=embed`;
    }
    
    return null;
  };

  // Handle chat submission
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
      
      // For request payload, ensure we have fallbacks for book title
      const bookTitle = selectedBook || (bookChunks.length > 0 ? bookChunks[0].title : null);
      
      const requestPayload = {
        query,
        book: bookTitle,
        bookId: selectedBookId,
        chunks: bookChunks.length > 0 
          ? bookChunks.map(chunk => ({
              title: chunk.title || bookTitle || 'Unknown',
              author: chunk.author || 'Unknown',
              text: chunk.text || '',
              summary: chunk.summary || chunk.text?.substring(0, 200) || '',
              is_preview_info: chunk.is_preview_info
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

      // Use existing embedUrl if available from the chunks, otherwise use the one from the response
      const responseEmbedUrl = response.embedUrl || embedUrl;
      const responseBookTitle = response.book || bookTitle;

      if (extractionInProgress && selectedBookId) {
        try {
          console.log('Checking for newly extracted chunks');
          
          const updatedChunks = await fetchBookChunks(selectedBookId);
          if (updatedChunks && updatedChunks.length > 0) {
            console.log(`Now loaded ${updatedChunks.length} chunks after checking`);
            setBookChunks(updatedChunks);
            setExtractionInProgress(false);
            
            // Check for embed URL in the new chunks
            const newEmbedUrl = extractGoogleBooksEmbedUrl(updatedChunks);
            if (newEmbedUrl) {
              setEmbedUrl(newEmbedUrl);
              console.log('Found Google Books embed URL in updated chunks:', newEmbedUrl);
            }
            
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
                citations: responseBookTitle
                  ? [
                      {
                        book: responseBookTitle,
                        author: response.author || 'Unknown',
                        page: 1,
                      },
                    ]
                  : undefined,
                embedUrl: responseEmbedUrl
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
    extractionInProgress,
    embedUrl
  };
};

export default useChat;
