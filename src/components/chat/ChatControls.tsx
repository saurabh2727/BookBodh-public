
import React, { useState, useEffect } from 'react';
import QueryInput from '@/components/QueryInput';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

interface ChatControlsProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
  suggestions?: string[];
  selectedBookId?: string | null;
  selectedBookTitle?: string | null;
}

const ChatControls: React.FC<ChatControlsProps> = ({ 
  onSubmit, 
  isLoading,
  suggestions = [],
  selectedBookId,
  selectedBookTitle
}) => {
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>(suggestions);
  const [inputValue, setInputValue] = useState<string>('');
  const [showStartChat, setShowStartChat] = useState<boolean>(true);
  const { toast } = useToast();

  useEffect(() => {
    // Generate dynamic suggestions based on book selection
    if (selectedBookId && selectedBookTitle) {
      setDynamicSuggestions([
        `What is the main idea of ${selectedBookTitle}?`,
        `Tell me about the key concepts in ${selectedBookTitle}`,
        `Summarize ${selectedBookTitle}`,
        `What can I learn from ${selectedBookTitle}?`
      ]);
      
      // Show welcome toast when a book is selected
      if (selectedBookId) {
        toast({
          title: "Book added to chat",
          description: `You can now chat with ${selectedBookTitle}`,
        });
      }
    } else {
      setDynamicSuggestions([
        "Please select a book to start chatting",
        "You need to select a book first",
        "Upload a book or select one from your library",
        "Chat requires a book selection"
      ]);
    }
  }, [selectedBookId, selectedBookTitle, toast]);

  const handleStartChat = () => {
    if (selectedBookId && selectedBookTitle) {
      // Reset the start chat button visibility
      setShowStartChat(false);
      
      // Use a default question to start the chat
      const defaultQuestion = `Tell me about the main ideas in ${selectedBookTitle}`;
      setInputValue(defaultQuestion);
      onSubmit(defaultQuestion);
    } else {
      toast({
        variant: "destructive",
        title: "No book selected",
        description: "Please select a book first to start chatting.",
      });
    }
  };

  return (
    <div className="mt-4 px-4 py-4 border-t border-border/50 bg-background/95 backdrop-blur-sm">
      {selectedBookId && showStartChat ? (
        <div className="mb-4 flex justify-center">
          <Button 
            onClick={handleStartChat}
            className="flex items-center gap-2"
            disabled={isLoading}
          >
            <MessageCircle className="h-4 w-4" />
            Start Chat with {selectedBookTitle}
          </Button>
        </div>
      ) : null}
      
      <QueryInput 
        onSubmit={onSubmit} 
        isLoading={isLoading} 
        suggestions={dynamicSuggestions}
        disabled={!selectedBookId}
        placeholderText={selectedBookId ? "Ask a question about this book..." : "Select a book to start chatting..."}
        value={inputValue}
        onChange={setInputValue}
      />
    </div>
  );
};

export default ChatControls;
