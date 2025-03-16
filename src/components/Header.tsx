
import React from 'react';
import { Button } from '@/components/ui/button';
import { Menu, BookOpen, LogOut } from 'lucide-react';
import { signOut } from '@/services/api';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import ThemeToggle from './ThemeToggle';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Sign out failed",
        description: "Failed to sign out. Please try again.",
      });
    }
  };

  return (
    <header className="flex justify-between items-center py-4 px-6 border-b bg-background/80 backdrop-blur-sm">
      <div className="flex items-center">
        <BookOpen className="h-6 w-6 mr-2 text-primary" />
        <h1 className="text-xl font-bold">BookBodh</h1>
      </div>
      
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleSignOut}
          title="Sign Out"
          className="rounded-full"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
};

export default Header;
