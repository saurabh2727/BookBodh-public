
import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ChatMessage from './ChatMessage';
import QueryInput from './QueryInput';
import { Button } from '@/components/ui/button';
import { BookOpen } from 'lucide-react';
import { ChatMessage as ChatMessageType, Book } from '@/types';
import { initialMessages, sampleCitations } from '@/utils/mockData';
import BookSelector from './BookSelector';

interface ChatInterfaceProps {
  selectedBook: string | null;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ selectedBook }) => {
  const [messages, setMessages] = useState<ChatMessageType[]>(initialMessages);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [chatMode, setChatMode] = useState<'saved' | 'temp'>('saved');
  const [showBookSelector, setShowBookSelector] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // If a book was selected, show a welcome message
  useEffect(() => {
    if (selectedBook && messages.length <= 1) {
      // Add a bot message about the selected book
      const bookWelcomeMessage: ChatMessageType = {
        id: uuidv4(),
        content: `I'm here to discuss "${selectedBook}" with you. What would you like to know about the ideas in this book?`,
        type: 'bot',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, bookWelcomeMessage]);
    }
  }, [selectedBook]);

  const handleSubmit = async (query: string) => {
    if (isLoading) return;

    // Add user message
    const userMessage: ChatMessageType = {
      id: uuidv4(),
      content: query,
      type: 'user',
      timestamp: new Date(),
    };

    // Add a loading message
    const loadingMessage: ChatMessageType = {
      id: uuidv4(),
      content: '',
      type: 'bot',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setIsLoading(true);

    // Simulate API response delay
    setTimeout(() => {
      // Remove loading message and add bot response
      setMessages(prev => {
        const withoutLoading = prev.filter(m => !m.isLoading);
        
        // Generate mock response based on query
        let response = "";
        let bookCitations = [] as ChatMessageType['citations'];
        
        if (query.toLowerCase().includes("lie") || query.toLowerCase().includes("truth")) {
          response = "The ethics of lying is complex. Kant believed that lying is always wrong, as it violates the categorical imperative. However, consequentialists argue that the morality of a lie depends on its outcomes. According to Aristotle's virtue ethics, honesty is a virtue, but phronesis (practical wisdom) determines when truth-telling might cause more harm than good.";
          bookCitations = [
            {
              book: "Groundwork of the Metaphysics of Morals",
              author: "Immanuel Kant",
              page: 42
            },
            {
              book: "Nicomachean Ethics",
              author: "Aristotle",
              page: 87
            }
          ];
        } else if (query.toLowerCase().includes("happiness") || query.toLowerCase().includes("obligation")) {
          response = "The tension between personal happiness and obligations to others is a central concern in ethical philosophy. Mill's utilitarianism suggests maximizing overall happiness, which may require personal sacrifice. Aristotle proposes that eudaimonia (flourishing) involves fulfilling one's social roles while developing personal excellence. Contemporary philosopher Derek Parfit suggests that personal identity is less important than we think, potentially reducing this tension.";
          bookCitations = [
            {
              book: "Utilitarianism",
              author: "John Stuart Mill",
              page: 33
            },
            {
              book: "Nicomachean Ethics",
              author: "Aristotle",
              page: 125
            },
            {
              book: "Reasons and Persons",
              author: "Derek Parfit",
              page: 281
            }
          ];
        } else if (query.toLowerCase().includes("rules") || query.toLowerCase().includes("consequences")) {
          response = "The debate between rule-based ethics (deontology) and consequence-based ethics (consequentialism) is longstanding. Kant argues that moral rules derived from reason should be followed regardless of outcomes. Bentham and Mill counter that the right action maximizes good consequences. Some philosophers like W.D. Ross propose prima facie duties that can be overridden when they conflict.";
          bookCitations = [
            {
              book: "Critique of Practical Reason",
              author: "Immanuel Kant",
              page: 72
            },
            {
              book: "An Introduction to the Principles of Morals and Legislation",
              author: "Jeremy Bentham",
              page: 14
            }
          ];
        } else {
          response = "Ethical dilemmas often involve competing values that cannot be easily resolved. Martha Nussbaum's capabilities approach suggests focusing on enabling human flourishing across multiple dimensions. Bernard Williams notes that moral luck plays a role in ethical outcomes beyond our control. Contemporary philosopher T.M. Scanlon proposes that morality is about finding principles no one could reasonably reject.";
          bookCitations = [
            {
              book: "Creating Capabilities",
              author: "Martha Nussbaum",
              page: 58
            },
            {
              book: "Moral Luck",
              author: "Bernard Williams",
              page: 29
            },
            {
              book: "What We Owe to Each Other",
              author: "T.M. Scanlon",
              page: 153
            }
          ];
        }
        
        // If no book is selected, suggest books relevant to the query
        if (!selectedBook) {
          const suggestedBooks = `Based on your question, you might find these books helpful: ${bookCitations.map(c => `"${c.book}" by ${c.author}`).join(', ')}.`;
          response = `${response}\n\n${suggestedBooks}`;
        }
        
        return [...withoutLoading, {
          id: uuidv4(),
          content: response,
          type: 'bot',
          timestamp: new Date(),
          citations: bookCitations
        }];
      });
      
      setIsLoading(false);
    }, 3000);
  };

  return (
    <div className="flex flex-col h-full">
      {!selectedBook && messages.length <= 1 && (
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
              onClick={() => setShowBookSelector(true)}
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Select a Book
            </Button>
            <Button
              variant={chatMode === 'saved' ? 'default' : 'outline'}
              className={chatMode === 'saved' ? '' : 'bg-primary/5 hover:bg-primary/10 border-primary/20'}
              onClick={() => setChatMode('saved')}
              size="sm"
            >
              Saved Chat
            </Button>
            <Button
              variant={chatMode === 'temp' ? 'default' : 'outline'}
              className={chatMode === 'temp' ? '' : 'bg-primary/5 hover:bg-primary/10 border-primary/20'}
              onClick={() => setChatMode('temp')}
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
                onClick={() => handleSubmit("What's the ethical perspective on telling white lies?")}
              >
                Ethics of white lies?
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs"
                onClick={() => handleSubmit("How do I balance personal happiness with duties to others?")}
              >
                Balance happiness & duty?
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs"
                onClick={() => handleSubmit("Are rules more important than consequences?")}
              >
                Rules vs. consequences?
              </Button>
            </div>
          </div>
        </div>
      )}

      {(selectedBook || messages.length > 1) && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hidden">
            <div className="space-y-6">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          <div className="p-4 border-t border-border/40 bg-background glass-effect">
            <QueryInput onSubmit={handleSubmit} isLoading={isLoading} />
          </div>
        </>
      )}

      {showBookSelector && (
        <BookSelector 
          onClose={() => setShowBookSelector(false)}
          onSelectBook={(book) => {
            setShowBookSelector(false);
            // Logic to load book
          }}
        />
      )}
    </div>
  );
};

export default ChatInterface;
