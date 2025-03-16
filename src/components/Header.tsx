
import React from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';

const Header: React.FC = () => {
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Signed out successfully",
        description: "You have been logged out of your account."
      });
    } catch (error: any) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-xl items-center">
        <div className="mr-4 flex">
          <a href="/" className="flex items-center space-x-2">
            <span className="font-bold inline-block">BookBodh</span>
          </a>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <nav className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleSignOut} 
              title="Sign out"
            >
              <LogOut className="h-[1.2rem] w-[1.2rem]" />
            </Button>
            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
