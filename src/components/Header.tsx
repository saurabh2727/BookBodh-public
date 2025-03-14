
import React from 'react';
import { BookOpen } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const Header: React.FC = () => {
  return (
    <header className="w-full py-6 px-4 flex items-center justify-between animate-fade-in-slow">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-display font-medium tracking-tight">
            <span className="gradient-text">Book</span> Bodh
          </h1>
          <p className="text-xs text-muted-foreground">Wisdom from great books</p>
        </div>
      </div>
      <ThemeToggle />
    </header>
  );
};

export default Header;
