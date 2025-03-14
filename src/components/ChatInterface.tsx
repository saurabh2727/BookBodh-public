
import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ChatMessage from './ChatMessage';
import QueryInput from './QueryInput';
import { ChatMessage as ChatMessageType } from '@/types';
import { initialMessages, sampleCitations } from '@/utils/mockData';

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessageType[]>(initialMessages);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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
        if (query.toLowerCase().includes("lie") || query.toLowerCase().includes("truth")) {
          response = "The ethics of lying is complex. Kant believed that lying is always wrong, as it violates the categorical imperative. However, consequentialists argue that the morality of a lie depends on its outcomes. According to Aristotle's virtue ethics, honesty is a virtue, but phronesis (practical wisdom) determines when truth-telling might cause more harm than good.";
        } else if (query.toLowerCase().includes("happiness") || query.toLowerCase().includes("obligation")) {
          response = "The tension between personal happiness and obligations to others is a central concern in ethical philosophy. Mill's utilitarianism suggests maximizing overall happiness, which may require personal sacrifice. Aristotle proposes that eudaimonia (flourishing) involves fulfilling one's social roles while developing personal excellence. Contemporary philosopher Derek Parfit suggests that personal identity is less important than we think, potentially reducing this tension.";
        } else if (query.toLowerCase().includes("rules") || query.toLowerCase().includes("consequences")) {
          response = "The debate between rule-based ethics (deontology) and consequence-based ethics (consequentialism) is longstanding. Kant argues that moral rules derived from reason should be followed regardless of outcomes. Bentham and Mill counter that the right action maximizes good consequences. Some philosophers like W.D. Ross propose prima facie duties that can be overridden when they conflict.";
        } else {
          response = "Ethical dilemmas often involve competing values that cannot be easily resolved. Martha Nussbaum's capabilities approach suggests focusing on enabling human flourishing across multiple dimensions. Bernard Williams notes that moral luck plays a role in ethical outcomes beyond our control. Contemporary philosopher T.M. Scanlon proposes that morality is about finding principles no one could reasonably reject.";
        }
        
        return [...withoutLoading, {
          id: uuidv4(),
          content: response,
          type: 'bot',
          timestamp: new Date(),
          citations: sampleCitations.slice(0, Math.floor(Math.random() * 3) + 1)
        }];
      });
      
      setIsLoading(false);
    }, 3000);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
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
    </div>
  );
};

export default ChatInterface;
