
import React from 'react';
import QueryInput from '../QueryInput';

interface ChatControlsProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
}

const ChatControls: React.FC<ChatControlsProps> = ({ onSubmit, isLoading }) => {
  return (
    <div className="p-4 border-t border-border/40 bg-background glass-effect">
      <QueryInput onSubmit={onSubmit} isLoading={isLoading} />
    </div>
  );
};

export default ChatControls;
