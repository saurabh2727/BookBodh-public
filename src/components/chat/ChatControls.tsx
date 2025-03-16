
import React, { useState, useEffect } from 'react';
import QueryInput from '@/components/QueryInput';

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

  useEffect(() => {
    // Generate dynamic suggestions based on book selection
    if (selectedBookId && selectedBookTitle) {
      setDynamicSuggestions([
        `What is the main idea of ${selectedBookTitle}?`,
        `Tell me about the key concepts in ${selectedBookTitle}`,
        `Summarize ${selectedBookTitle}`,
        `What can I learn from ${selectedBookTitle}?`
      ]);
    } else {
      setDynamicSuggestions([
        "Please select a book to start chatting",
        "You need to select a book first",
        "Upload a book or select one from your library",
        "Chat requires a book selection"
      ]);
    }
  }, [selectedBookId, selectedBookTitle]);

  return (
    <div className="mt-4 px-4 py-4 border-t border-border/50 bg-background/95 backdrop-blur-sm">
      <QueryInput 
        onSubmit={onSubmit} 
        isLoading={isLoading} 
        suggestions={dynamicSuggestions}
        disabled={!selectedBookId}
        placeholderText={selectedBookId ? "Ask a question about this book..." : "Select a book to start chatting..."}
      />
    </div>
  );
};

export default ChatControls;
