
import React, { useState } from 'react';
import Header from '@/components/Header';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BookOpen, MessageCircle } from 'lucide-react';
import BooksGrid from '@/components/BooksGrid';
import ChatInterface from '@/components/ChatInterface';

const Index = () => {
  const [selectedBook, setSelectedBook] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-secondary/20 to-background">
      <Header />
      <main className="flex-1 flex flex-col w-full mx-auto px-4 pb-6">
        <Tabs defaultValue="books" className="w-full max-w-4xl mx-auto mt-4">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="books" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span>Books</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span>Chat</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="books" className="space-y-6 animate-fade-in">
            <BooksGrid onSelectBook={setSelectedBook} />
          </TabsContent>
          
          <TabsContent value="chat" className="h-[calc(100vh-16rem)]">
            <ChatInterface selectedBookId={selectedBook} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
