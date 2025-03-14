
import React from 'react';
import Header from '@/components/Header';
import ChatInterface from '@/components/ChatInterface';

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-secondary/20 to-background">
      <Header />
      <main className="flex-1 flex flex-col max-w-4xl w-full mx-auto">
        <ChatInterface />
      </main>
    </div>
  );
};

export default Index;
