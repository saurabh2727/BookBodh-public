
import React from 'react';
import { Button } from '@/components/ui/button';
import { BookOpen } from 'lucide-react';

interface ChatWelcomeProps {
  onSelectBookClick: () => void;
  onChatModeChange: (mode: 'saved' | 'temp') => void;
  chatMode: 'saved' | 'temp';
  onExampleQuestionClick: (question: string) => void;
}

const ChatWelcome: React.FC<ChatWelcomeProps> = ({
  onSelectBookClick,
  onChatModeChange,
  chatMode,
  onExampleQuestionClick
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 animate-fade-in">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <BookOpen className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-2xl font-display font-medium">Chat with a Book</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        Get advice and wisdom from great books. You can ask a question directly 
        or select a book to have a focused conversation.
      </p>
      <div className="flex flex-wrap gap-2 justify-center mt-4">
        <Button 
          variant="outline" 
          className="bg-primary/5 hover:bg-primary/10 border-primary/20"
          onClick={onSelectBookClick}
        >
          <BookOpen className="mr-2 h-4 w-4" />
          Select a Book
        </Button>
        <Button
          variant={chatMode === 'saved' ? 'default' : 'outline'}
          className={chatMode === 'saved' ? '' : 'bg-primary/5 hover:bg-primary/10 border-primary/20'}
          onClick={() => onChatModeChange('saved')}
          size="sm"
        >
          Saved Chat
        </Button>
        <Button
          variant={chatMode === 'temp' ? 'default' : 'outline'}
          className={chatMode === 'temp' ? '' : 'bg-primary/5 hover:bg-primary/10 border-primary/20'}
          onClick={() => onChatModeChange('temp')}
          size="sm"
        >
          Temp Chat
        </Button>
      </div>
      <div className="max-w-md mx-auto mt-4 text-center">
        <p className="text-sm text-muted-foreground mb-2">Example questions:</p>
        <div className="flex flex-wrap gap-2 justify-center">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs"
            onClick={() => onExampleQuestionClick("What's the ethical perspective on telling white lies?")}
          >
            Ethics of white lies?
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs"
            onClick={() => onExampleQuestionClick("How do I balance personal happiness with duties to others?")}
          >
            Balance happiness & duty?
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs"
            onClick={() => onExampleQuestionClick("Are rules more important than consequences?")}
          >
            Rules vs. consequences?
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatWelcome;
