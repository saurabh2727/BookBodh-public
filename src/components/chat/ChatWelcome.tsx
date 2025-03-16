
import React from 'react';
import { Button } from '@/components/ui/button';
import { Database, BookPlus, BookOpen } from 'lucide-react';

interface ChatWelcomeProps {
  onUploadBookClick: () => void;
  onSelectBookClick: () => void;
  onExampleQuestionClick: (query: string) => void;
}

const ChatWelcome: React.FC<ChatWelcomeProps> = ({
  onUploadBookClick,
  onSelectBookClick,
  onExampleQuestionClick,
}) => {
  const exampleQuestions = [
    "What is the main idea of this book?",
    "Can you summarize the key points?",
    "What lessons can I learn from this book?",
    "How can I apply the concepts from this book in my life?"
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-4">
      <h2 className="text-3xl font-bold mb-6">Welcome to BookBodh</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        Chat with your favorite books! Select a book from your library or upload a new one to get started.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <Button 
          variant="outline" 
          size="lg" 
          className="flex items-center gap-2 px-8"
          onClick={onSelectBookClick}
        >
          <BookOpen className="h-5 w-5" />
          Select a Book
        </Button>
        
        <Button 
          variant="default" 
          size="lg" 
          className="flex items-center gap-2 px-8"
          onClick={onUploadBookClick}
        >
          <BookPlus className="h-5 w-5" />
          Upload a Book
        </Button>
      </div>
      
      <div className="border-t border-border/30 w-full max-w-md pt-8 mt-4">
        <h3 className="text-lg font-medium mb-4">Example Questions</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select a book first, then you can ask questions like:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {exampleQuestions.map((question, index) => (
            <Button
              key={index}
              variant="ghost"
              className="justify-start text-left text-sm h-auto py-2 px-3"
              onClick={() => onExampleQuestionClick(question)}
            >
              {question}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChatWelcome;
