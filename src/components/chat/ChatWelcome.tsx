
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChatMode } from '@/types';
import { BookOpen, MessageCircle, Upload } from 'lucide-react';

interface ChatWelcomeProps {
  onSelectBookClick: () => void;
  onUploadBookClick: () => void;
  onChatModeChange: (mode: ChatMode) => void;
  chatMode: ChatMode;
  onExampleQuestionClick: (question: string) => void;
}

const exampleQuestions = [
  "What is the meaning of life according to Viktor Frankl?",
  "Explain the concept of Personal Legend from The Alchemist.",
  "How does Marcus Aurelius suggest we deal with difficult people?"
];

const ChatWelcome: React.FC<ChatWelcomeProps> = ({
  onSelectBookClick,
  onUploadBookClick,
  onChatModeChange,
  chatMode,
  onExampleQuestionClick
}) => {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold font-display">Welcome to BookBodh</h1>
          <p className="text-muted-foreground">
            Ask questions about books and get insightful answers based on their content
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card className="transition-colors cursor-pointer hover:bg-muted/50"
                onClick={() => onChatModeChange('general')}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-lg">
                <MessageCircle className="h-5 w-5 mr-2" />
                General Chat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Chat about any book in our library
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="transition-colors cursor-pointer hover:bg-muted/50"
                onClick={() => onChatModeChange('specific-book')}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-lg">
                <BookOpen className="h-5 w-5 mr-2" />
                Book Specific
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Focus on a specific book for deeper insights
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={onSelectBookClick}
          >
            <BookOpen className="h-4 w-4" />
            Browse Books
          </Button>
          
          <Button 
            variant="outline" 
            className="flex items-center gap-2"
            onClick={onUploadBookClick}
          >
            <Upload className="h-4 w-4" />
            Upload a Book
          </Button>
        </div>

        <div className="space-y-4">
          <h3 className="text-center text-sm font-medium text-muted-foreground">
            Try asking
          </h3>
          <div className="grid gap-2">
            {exampleQuestions.map((question, index) => (
              <Button 
                key={index} 
                variant="ghost" 
                className="justify-start text-left text-muted-foreground hover:text-foreground"
                onClick={() => onExampleQuestionClick(question)}
              >
                {question}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatWelcome;
