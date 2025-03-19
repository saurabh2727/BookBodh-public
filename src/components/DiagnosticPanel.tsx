
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { useToast } from './ui/use-toast';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

interface ApiResponse {
  [key: string]: any;
}

const DiagnosticPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('directories');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [bookId, setBookId] = useState('');
  const [bookTitle, setBookTitle] = useState('Test Book');
  const { toast } = useToast();

  const fetchDiagnosticData = async (endpoint: string) => {
    setIsLoading(true);
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
      setResponse({ error: error instanceof Error ? error.message : "Unknown error occurred" });
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
      setResponse({ error: error instanceof Error ? error.message : "Unknown error occurred" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Load directories data on initial render
    fetchDiagnosticData('directories');
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>System Diagnostics</CardTitle>
        <CardDescription>
          Tools to debug book extraction and system configuration
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                disabled={isLoading || !bookId.trim()}
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
              disabled={isLoading} 
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
              disabled={isLoading} 
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
              disabled={isLoading} 
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
                {activeTab === 'directories' && response.contents && (
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
                )}
                
                {activeTab === 'books' && (
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <h3 className="font-semibold text-lg">Books</h3>
                      <Badge className="ml-2">
                        {response.books_count || 0} books
                      </Badge>
                    </div>
                    
                    {response.status === 'error' ? (
                      <div className="text-red-500">
                        <p>{response.message}</p>
                        <pre className="mt-2 text-xs bg-gray-100 p-2 rounded">{response.error}</pre>
                      </div>
                    ) : response.books && response.books.length > 0 ? (
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
                )}
                
                {activeTab === 'selenium' && (
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <h3 className="font-semibold text-lg">Selenium Test</h3>
                      <Badge className={`ml-2 ${response.status === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                        {response.status}
                      </Badge>
                    </div>
                    
                    {response.status === 'success' ? (
                      <div className="space-y-2">
                        <p>{response.message}</p>
                        <p>Page title: <span className="font-medium">{response.title}</span></p>
                        <p>Driver info: <span className="font-medium">{response.driver_info}</span></p>
                        <p>
                          Screenshot: 
                          <Badge className={`ml-2 ${response.screenshot_saved ? 'bg-green-600' : 'bg-red-600'}`}>
                            {response.screenshot_saved ? 'Saved' : 'Failed'}
                          </Badge>
                        </p>
                        {response.screenshot_saved && (
                          <p className="text-sm text-muted-foreground break-all">
                            Path: {response.screenshot_path}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-red-500">
                        <p>{response.message}</p>
                        <pre className="mt-2 text-xs bg-gray-100 p-2 rounded">{response.error}</pre>
                        {response.traceback && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm">View traceback</summary>
                            <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                              {response.traceback}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {activeTab === 'extraction' && response && (
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <h3 className="font-semibold text-lg">Book Extraction Test</h3>
                      {response.status && (
                        <Badge className={`ml-2 ${response.status === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                          {response.status}
                        </Badge>
                      )}
                    </div>
                    
                    {response.status === 'success' ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium">Book ID</p>
                            <p className="text-sm text-muted-foreground">{response.book_id}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Title</p>
                            <p className="text-sm text-muted-foreground">{response.title}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Text Length</p>
                            <p className="text-sm text-muted-foreground">
                              {response.text_length} characters
                              {response.text_length > 0 ? (
                                <Badge className="ml-2 bg-green-600">Text extracted</Badge>
                              ) : (
                                <Badge className="ml-2 bg-red-600">No text</Badge>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Screenshots</p>
                            <p className="text-sm text-muted-foreground">
                              {response.screenshots_count} screenshots
                              {response.screenshots_count > 0 ? (
                                <Badge className="ml-2 bg-green-600">Screenshots taken</Badge>
                              ) : (
                                <Badge className="ml-2 bg-red-600">No screenshots</Badge>
                              )}
                            </p>
                          </div>
                        </div>
                        
                        {response.text_sample && (
                          <div>
                            <p className="text-sm font-medium">Text Sample</p>
                            <div className="text-sm mt-1 p-3 bg-muted rounded">
                              {response.text_sample}
                            </div>
                          </div>
                        )}
                        
                        {response.screenshots && response.screenshots.length > 0 && (
                          <div>
                            <p className="text-sm font-medium">Screenshots</p>
                            <div className="grid grid-cols-1 gap-2 mt-1">
                              {response.screenshots.map((screenshot: any, index: number) => (
                                <div key={index} className="flex items-center text-sm p-2 bg-muted rounded">
                                  {screenshot.exists ? (
                                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-500 mr-2" />
                                  )}
                                  <span className="text-sm truncate flex-1">{screenshot.filename || screenshot.path}</span>
                                  {screenshot.exists && (
                                    <span className="text-muted-foreground">
                                      {(screenshot.size_bytes / 1024).toFixed(2)} KB
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div>
                          <p className="text-sm font-medium">Directories</p>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <div className="text-sm">
                              <span className="text-muted-foreground">Cache:</span> {response.cache_dir}
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Screenshots:</span> {response.screenshots_dir}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-red-500">
                        <p>{response.message}</p>
                        <pre className="mt-2 text-xs bg-gray-100 p-2 rounded">{response.error}</pre>
                        {response.traceback && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm">View traceback</summary>
                            <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                              {response.traceback}
                            </pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Debug view - shows raw JSON response */}
                <details className="mt-4 pt-4 border-t">
                  <summary className="cursor-pointer text-sm font-medium">Raw Response Data</summary>
                  <pre className="mt-2 p-2 text-xs bg-gray-100 rounded overflow-auto max-h-40">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                </details>
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
