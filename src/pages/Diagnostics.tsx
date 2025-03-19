
import React from 'react';
import Header from '@/components/Header';
import DiagnosticPanel from '@/components/DiagnosticPanel';

const Diagnostics: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <div className="container max-w-6xl mx-auto py-6 px-4 flex-1">
        <h1 className="text-2xl font-bold mb-6">System Diagnostics</h1>
        <DiagnosticPanel />
      </div>
    </div>
  );
};

export default Diagnostics;
