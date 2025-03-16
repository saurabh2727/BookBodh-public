import React, { useState, useEffect } from 'react';
import BookSelector from './BookSelector';
import ChatWelcome from './chat/ChatWelcome';
import ChatMessages from './chat/ChatMessages';
import ChatControls from './chat/ChatControls';
import BookUpload from './BookUpload';
import useChat from '@/hooks/useChat';
import { Book } from '@/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchUserBooks } from '@/services/api';

interface ChatInterfaceProps {
  selectedBookId?: string | null;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ selectedBookId }) => {
  const [showBookSelector, setShowBookSelector] = useState<boolean>(false);
  const [showBookUpload, setShowBookUpload] = useState<boolean>(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const navigate = useNavigate();
  
  const {
    messages,
    isLoading,
    chatMode,
    setChatMode,
    handleSubmit
  } = useChat(selectedBook?.title || null, selectedBookId);

  const handleSelectBookClick = () => {
    setShowBookSelector(true);
  };

  const handleUploadBookClick = () => {
    setShowBookUpload(true);
  };

  const handleBookSelection = (book: Book) => {
    setSelectedBook(book);
    setShowBookSelector(false);
    
    // Redirect to chat with the selected book
    navigate(`/chat/${book.id}`);
  };

  const handleUploadComplete = (success: boolean, message: string, bookId?: string) => {
    if (success && bookId) {
      // Close the upload dialog after a delay to show the success message
      setTimeout(() => {
        setShowBookUpload(false);
        // Navigate to chat with the newly uploaded book
        navigate(`/chat/${bookId}`);
      }, 2000);
    }
    // Keep dialog open on failure so user can try again
  };

  // Load book data if a book ID is provided
  useEffect(() => {
    const loadBookData = async () => {
      if (selectedBookId) {
        try {
          console.log('Loading book data for book ID:', selectedBookId);
          const books = await fetchUserBooks();
          const book = books.find(b => b.id === selectedBookId);
          if (book) {
            setSelectedBook(book);
          }
        } catch (error) {
          console.error('Error loading book data:', error);
        }
      }
    };

    loadBookData();
  }, [selectedBookId]);

  return (
    <div className="flex flex-col h-full">
      {!selectedBookId && messages.length <= 1 ? (
        <ChatWelcome
          onSelectBookClick={handleSelectBookClick}
          onChatModeChange={setChatMode}
          chatMode={chatMode}
          onExampleQuestionClick={handleSubmit}
          onUploadBookClick={handleUploadBookClick}
        />
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            {selectedBook && (
              <div className="text-sm font-medium text-muted-foreground">
                Chatting with: {selectedBook.title} by {selectedBook.author}
              </div>
            )}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-2"
                onClick={handleSelectBookClick}
              >
                Select Book
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-2"
                onClick={handleUploadBookClick}
              >
                <Upload className="h-4 w-4" />
                Upload Book
              </Button>
            </div>
          </div>
          <ChatMessages messages={messages} />
          <ChatControls onSubmit={handleSubmit} isLoading={isLoading} />
        </>
      )}

      {showBookSelector && (
        <BookSelector 
          onClose={() => setShowBookSelector(false)}
          onSelectBook={handleBookSelection}
        />
      )}

      {showBookUpload && (
        <Sheet open={true} onOpenChange={setShowBookUpload}>
          <SheetContent side="right" className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Upload New Book</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <BookUpload 
                onClose={() => setShowBookUpload(false)}
                onUploadComplete={handleUploadComplete}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};

export default ChatInterface;
