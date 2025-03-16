
import React, { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { Button } from '@/components/ui/button';
import { signOut, checkAuth } from '@/services/api';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const Header = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  useEffect(() => {
    const checkAuthentication = async () => {
      const session = await checkAuth();
      setIsAuthenticated(!!session);
    };
    
    checkAuthentication();
  }, []);
  
  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
      navigate('/login');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive"
      });
      console.error('Sign out error:', error);
    }
  };
  
  return (
    <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="flex items-center gap-2 font-bold">
          <BookOpen className="h-5 w-5" />
          <span className="hidden sm:inline-block">BookBodh</span>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-2">
          <div className="w-full flex-1 md:w-auto md:flex-none"></div>
          
          <nav className="flex items-center space-x-2">
            <ThemeToggle />
            
            {isAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
              >
                Sign Out
              </Button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
