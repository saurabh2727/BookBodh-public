import React, { useState } from 'react';
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

interface ChatInterfaceProps {
  selectedBook: string | null;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ selectedBook }) => {
  const [showBookSelector, setShowBookSelector] = useState<boolean>(false);
  const [showBookUpload, setShowBookUpload] = useState<boolean>(false);
  
  const {
    messages,
    isLoading,
    chatMode,
    setChatMode,
    handleSubmit
  } = useChat(selectedBook);

  const handleSelectBookClick = () => {
    setShowBookSelector(true);
  };

  const handleUploadBookClick = () => {
    setShowBookUpload(true);
  };

  const handleBookSelection = (book: Book) => {
    setShowBookSelector(false);
    // Logic to load book would go here
  };

  const handleUploadComplete = (success: boolean, message: string) => {
    if (success) {
      // Close the upload dialog after a delay to show the success message
      setTimeout(() => {
        setShowBookUpload(false);
      }, 2000);
    }
    // Keep dialog open on failure so user can try again
  };

  return (
    <div className="flex flex-col h-full">
      {!selectedBook && messages.length <= 1 ? (
        <ChatWelcome
          onSelectBookClick={handleSelectBookClick}
          onChatModeChange={setChatMode}
          chatMode={chatMode}
          onExampleQuestionClick={handleSubmit}
          onUploadBookClick={handleUploadBookClick}
        />
      ) : (
        <>
          <div className="flex justify-end mb-4">
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
