
import React, { useState } from 'react';
import BookSelector from './BookSelector';
import ChatWelcome from './chat/ChatWelcome';
import ChatMessages from './chat/ChatMessages';
import ChatControls from './chat/ChatControls';
import useChat from '@/hooks/useChat';
import { Book } from '@/types';

interface ChatInterfaceProps {
  selectedBook: string | null;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ selectedBook }) => {
  const [showBookSelector, setShowBookSelector] = useState<boolean>(false);
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

  const handleBookSelection = (book: Book) => {
    setShowBookSelector(false);
    // Logic to load book would go here
  };

  return (
    <div className="flex flex-col h-full">
      {!selectedBook && messages.length <= 1 ? (
        <ChatWelcome
          onSelectBookClick={handleSelectBookClick}
          onChatModeChange={setChatMode}
          chatMode={chatMode}
          onExampleQuestionClick={handleSubmit}
        />
      ) : (
        <>
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
    </div>
  );
};

export default ChatInterface;
