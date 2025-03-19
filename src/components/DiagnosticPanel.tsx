
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { useToast } from './ui/use-toast';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Info, ServerCrash } from 'lucide-react';

interface ApiResponse {
  [key: string]: any;
}

const DiagnosticPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('directories');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [bookId, setBookId] = useState('');
  const [bookTitle, setBookTitle] = useState('Test Book');
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const { toast } = useToast();

  const checkBackendConnection = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${baseUrl}/health`, {
        signal: controller.signal
      }).then(res => {
        clearTimeout(timeoutId);
        return res;
      });
      
      if (response.ok) {
        setIsBackendConnected(true);
        return true;
      } else {
        setIsBackendConnected(false);
        return false;
      }
    } catch (error) {
      console.error("Backend connection check failed:", error);
      setIsBackendConnected(false);
      return false;
    }
  };

  const fetchDiagnosticData = async (endpoint: string) => {
    setIsLoading(true);
    
    // Check backend connection first
    const isConnected = await checkBackendConnection();
    
    if (!isConnected) {
      setResponse({
        status: 'error',
        message: 'Cannot connect to backend server',
        details: 'The backend server appears to be offline or unreachable. Please make sure the FastAPI server is running.'
      });
      
      toast({
        variant: "destructive",
        title: "Backend connection failed",
        description: "Cannot connect to the backend server. Please make sure the FastAPI server is running.",
      });
      
      setIsLoading(false);
      return;
    }
    
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const url = `${baseUrl}/diagnostic/${endpoint}`;
      
      const response = await fetch(url);
      const data = await response.json();
      setResponse(data);
      
      toast({
        title: "Diagnostic data loaded",
        description: `Successfully fetched data from ${endpoint}`,
      });
    } catch (error) {
      console.error(`Error fetching diagnostic data from ${endpoint}:`, error);
      toast({
        variant: "destructive",
        title: "Error loading diagnostic data",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
      setResponse({ 
        error: error instanceof Error ? error.message : "Unknown error occurred",
        status: 'error',
        message: 'Failed to fetch diagnostic data',
        details: 'The request to the backend server failed. Check the console for more details.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'directories') {
      fetchDiagnosticData('directories');
    } else if (value === 'books') {
      fetchDiagnosticData('books');
    } else if (value === 'selenium') {
      fetchDiagnosticData('selenium');
    }
  };

  const handleBookExtractionTest = async () => {
    if (!bookId.trim()) {
      toast({
        variant: "destructive",
        title: "Book ID required",
        description: "Please enter a Google Books ID to test extraction",
      });
      return;
    }
    
    // Check backend connection first
    const isConnected = await checkBackendConnection();
    
    if (!isConnected) {
      toast({
        variant: "destructive",
        title: "Backend connection failed",
        description: "Cannot connect to the backend server. Please make sure the FastAPI server is running.",
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const url = `${baseUrl}/diagnostic/book-extraction/${bookId}?title=${encodeURIComponent(bookTitle)}`;
      
      const response = await fetch(url);
      const data = await response.json();
      setResponse(data);
      
      if (data.status === 'success') {
        toast({
          title: "Book extraction test completed",
          description: `Extracted ${data.text_length} characters and took ${data.screenshots_count} screenshots`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Book extraction failed",
          description: data.message || "Unknown error occurred",
        });
      }
    } catch (error) {
      console.error('Error testing book extraction:', error);
      toast({
        variant: "destructive",
        title: "Error testing book extraction",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
      setResponse({ 
        status: 'error',
        error: error instanceof Error ? error.message : "Unknown error occurred",
        message: 'Failed to test book extraction',
        details: 'The request to the backend server failed. Check the console for more details.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Check if backend is running before loading diagnostics
    checkBackendConnection().then(isConnected => {
      if (isConnected) {
        // Load directories data on initial render
        fetchDiagnosticData('directories');
      } else {
        setResponse({
          status: 'error',
          message: 'Cannot connect to backend server',
          details: 'The backend server appears to be offline or unreachable. Please make sure the FastAPI server is running.'
        });
        
        toast({
          variant: "destructive",
          title: "Backend connection failed",
          description: "Cannot connect to the backend server. Please make sure the FastAPI server is running.",
        });
      }
    });
  }, []);

  const renderBackendConnectionStatus = () => (
    <div className="flex items-center gap-2 justify-end mb-4">
      <div className="text-sm font-medium text-muted-foreground">Backend Server:</div>
      {isBackendConnected ? (
        <Badge className="bg-green-600">Connected</Badge>
      ) : (
        <Badge className="bg-red-600">Disconnected</Badge>
      )}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => checkBackendConnection()}
        className="ml-2"
      >
        Check Connection
      </Button>
    </div>
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>System Diagnostics</CardTitle>
            <CardDescription>
              Tools to debug book extraction and system configuration
            </CardDescription>
          </div>
          {renderBackendConnectionStatus()}
        </div>
      </CardHeader>
      <CardContent>
        {!isBackendConnected && (
          <div className="mb-6 p-4 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-md">
            <div className="flex items-start gap-3">
              <ServerCrash className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <h3 className="font-medium text-red-800 dark:text-red-300">Backend Server Unavailable</h3>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  The diagnostics features require the FastAPI backend server to be running. 
                  Please ensure it's started and accessible at {import.meta.env.VITE_API_URL || 'http://localhost:8000'}.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => checkBackendConnection()}
                  className="mt-3 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
                >
                  Retry Connection
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-4">
            <TabsTrigger value="directories">Directories</TabsTrigger>
            <TabsTrigger value="books">Books</TabsTrigger>
            <TabsTrigger value="selenium">Selenium Test</TabsTrigger>
            <TabsTrigger value="extraction">Book Extraction</TabsTrigger>
          </TabsList>
          
          <TabsContent value="extraction" className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <label htmlFor="bookId" className="text-sm font-medium">
                  Google Books ID
                </label>
                <Input 
                  id="bookId" 
                  value={bookId} 
                  onChange={(e) => setBookId(e.target.value)} 
                  placeholder="Enter Google Books ID" 
                />
              </div>
              <div className="flex-1 space-y-2">
                <label htmlFor="bookTitle" className="text-sm font-medium">
                  Book Title
                </label>
                <Input 
                  id="bookTitle" 
                  value={bookTitle} 
                  onChange={(e) => setBookTitle(e.target.value)} 
                  placeholder="Book title" 
                />
              </div>
              <Button 
                onClick={handleBookExtractionTest} 
                disabled={isLoading || !bookId.trim() || !isBackendConnected}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Extraction'
                )}
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Enter a Google Books ID to test the extraction process. You can find book IDs in Google Books URLs.
            </div>
          </TabsContent>
          
          <TabsContent value="directories">
            <Button 
              onClick={() => fetchDiagnosticData('directories')} 
              disabled={isLoading || !isBackendConnected} 
              size="sm" 
              className="mb-4"
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh Directory Info
            </Button>
          </TabsContent>
          
          <TabsContent value="books">
            <Button 
              onClick={() => fetchDiagnosticData('books')} 
              disabled={isLoading || !isBackendConnected} 
              size="sm" 
              className="mb-4"
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Refresh Books Info
            </Button>
          </TabsContent>
          
          <TabsContent value="selenium">
            <Button 
              onClick={() => fetchDiagnosticData('selenium')} 
              disabled={isLoading || !isBackendConnected} 
              size="sm" 
              className="mb-4"
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Test Selenium
            </Button>
          </TabsContent>
          
          <div className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading diagnostic data...</span>
              </div>
            ) : response ? (
              <ScrollArea className="h-[400px] rounded-md border p-4">
                {!isBackendConnected ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <ServerCrash className="h-12 w-12 text-red-500 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Backend Server Unavailable</h3>
                    <p className="text-muted-foreground max-w-md">
                      The diagnostics features require the FastAPI backend server to be running. 
                      Please ensure it's started and accessible.
                    </p>
                  </div>
                ) : activeTab === 'directories' && response.contents ? (
                  <div className="space-y-6">
                    {Object.entries(response.contents).map(([dirName, dirInfo]: [string, any]) => (
                      <div key={dirName} className="space-y-2">
                        <div className="flex items-center">
                          <h3 className="font-semibold text-lg">{dirName}</h3>
                          <Badge className={`ml-2 ${dirInfo.exists ? 'bg-green-600' : 'bg-red-600'}`}>
                            {dirInfo.exists ? 'Exists' : 'Missing'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{dirInfo.path}</p>
                        
                        {dirInfo.exists && !dirInfo.error && (
                          <>
                            <div className="text-sm">
                              {dirInfo.items_count} items
                              {dirInfo.note && <span className="text-muted-foreground"> ({dirInfo.note})</span>}
                            </div>
                            
                            {dirInfo.items && dirInfo.items.length > 0 ? (
                              <ul className="space-y-1 text-sm">
                                {dirInfo.items.map((item: any, index: number) => (
                                  <li key={index} className="flex items-center text-sm">
                                    <span className={`w-16 ${item.type === 'Directory' ? 'text-blue-500' : 'text-green-500'}`}>
                                      {item.type}
                                    </span>
                                    <span className="flex-1 truncate">{item.name}</span>
                                    {item.size_bytes !== null && (
                                      <span className="text-muted-foreground">
                                        {(item.size_bytes / 1024).toFixed(2)} KB
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">Directory is empty</p>
                            )}
                          </>
                        )}
                        
                        {dirInfo.error && (
                          <p className="text-sm text-red-500">{dirInfo.error}</p>
                        )}
                        
                        <Separator className="my-2" />
                      </div>
                    ))}
                  </div>
                ) : (
                  // Handle all other responses including error conditions
                  <div className="space-y-4">
                    {response.status === 'error' ? (
                      <div className="p-6 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-md">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                          <div>
                            <h3 className="font-medium text-red-800 dark:text-red-300">{response.message}</h3>
                            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                              {response.details || response.error || "An error occurred retrieving diagnostic information."}
                            </p>
                            
                            {response.traceback && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-sm text-red-700 dark:text-red-400">View error details</summary>
                                <pre className="mt-1 text-xs bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 p-2 rounded overflow-auto max-h-40">
                                  {response.traceback}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Render the specific tab content from above or a generic response viewer
                      activeTab === 'books' && response.books ? (
                        <div className="space-y-4">
                          <div className="flex items-center">
                            <h3 className="font-semibold text-lg">Books</h3>
                            <Badge className="ml-2">
                              {response.books_count || 0} books
                            </Badge>
                          </div>
                          
                          {response.books && response.books.length > 0 ? (
                            <div className="space-y-4">
                              {response.books.map((book: any) => (
                                <Card key={book.id} className="p-3">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <h4 className="font-medium">{book.title}</h4>
                                      <p className="text-sm text-muted-foreground">
                                        by {book.author}
                                      </p>
                                      <p className="text-sm mt-1">ID: {book.id}</p>
                                    </div>
                                    <div className="flex flex-col items-end space-y-1">
                                      <Badge className={book.chunks_count > 0 ? 'bg-green-600' : 'bg-yellow-600'}>
                                        {book.chunks_count} chunks
                                      </Badge>
                                      <Badge variant={book.has_file ? 'default' : 'outline'}>
                                        {book.has_file ? 'Has file' : 'No file'}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="mt-2 text-sm">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => {
                                        setActiveTab('extraction');
                                        setBookId(book.id);
                                        setBookTitle(book.title);
                                      }}
                                    >
                                      Test Extraction
                                    </Button>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">No books found</p>
                          )}
                        </div>
                      ) : (
                        // Default response display
                        <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto">
                          {JSON.stringify(response, null, 2)}
                        </pre>
                      )
                    )}
                    
                    {/* Debug view - shows raw JSON response */}
                    <details className="mt-4 pt-4 border-t">
                      <summary className="cursor-pointer text-sm font-medium">Raw Response Data</summary>
                      <pre className="mt-2 p-2 text-xs bg-gray-100 dark:bg-gray-800 rounded overflow-auto max-h-40">
                        {JSON.stringify(response, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </ScrollArea>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No diagnostic data available</p>
              </div>
            )}
          </div>
        </Tabs>
      </CardContent>
      <CardFooter className="justify-between text-xs text-muted-foreground">
        <div>System diagnostics for debugging book extraction issues</div>
        {activeTab === 'extraction' && (
          <div className="text-xs">
            Need a sample Google Books ID? Try: <span className="font-mono bg-muted px-1 rounded">_pYkTcVbS6YC</span>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default DiagnosticPanel;
