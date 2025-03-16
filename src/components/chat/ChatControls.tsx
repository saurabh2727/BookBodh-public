
import React, { useState } from 'react';
import QueryInput from '@/components/QueryInput';

interface ChatControlsProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
  suggestions?: string[];
}

const ChatControls: React.FC<ChatControlsProps> = ({ 
  onSubmit, 
  isLoading,
  suggestions = []
}) => {
  return (
    <div className="mt-4 px-4 py-4 border-t border-border/50 bg-background/95 backdrop-blur-sm">
      <QueryInput 
        onSubmit={onSubmit} 
        isLoading={isLoading} 
        suggestions={suggestions}
      />
    </div>
  );
};

export default ChatControls;
