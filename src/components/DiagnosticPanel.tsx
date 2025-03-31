
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { useToast } from './ui/use-toast';
import { toast as sonnerToast } from 'sonner';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Info, ServerCrash, RefreshCw, Bug, Code, Terminal } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BackendTestResult } from '@/types';

interface ApiResponse {
  [key: string]: any;
}

const DiagnosticPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('backend-test');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [backendResult, setBackendResult] = useState<BackendTestResult | null>(null);
  const [bookId, setBookId] = useState('');
  const [bookTitle, setBookTitle] = useState('Test Book');
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [apiUrl, setApiUrl] = useState(import.meta.env.VITE_API_URL || 'http://localhost:8000');
  const [isTesting, setIsTesting] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const { toast } = useToast();

  const checkBackendConnection = async (showToast = true) => {
    try {
      setIsTesting(true);
      console.log(`Testing backend connection to ${apiUrl}`);
      
      const { data, error } = await supabase.functions.invoke('test-backend-api', {
        body: { 
          url: apiUrl,
          additionalPaths: true,
          debug: isDebugMode
        }
      });
      
      if (error) {
        console.error('Edge function error:', error);
        setIsBackendConnected(false);
        setBackendResult(null);
        
        if (showToast) {
          toast({
            variant: "destructive",
            title: "Backend test failed",
            description: `Edge function error: ${error.message}`,
          });
        }
        return false;
      }
      
      setBackendResult(data);
      
      setIsBackendConnected(data.success);
      
      if (data.success) {
        if (showToast) {
          toast({
            title: "Backend connected",
            description: `Successfully connected to ${data.backend_url}`,
          });
        }
        
        if (data.suggested_backend_url && data.suggested_backend_url !== apiUrl) {
          sonnerToast.info(
            `A different backend URL might work better: ${data.suggested_backend_url}`, 
            {
              action: {
                label: 'Use this URL',
                onClick: () => {
                  setApiUrl(data.suggested_backend_url);
                  localStorage.setItem('diagnostics_api_url', data.suggested_backend_url);
                  checkBackendConnection();
                }
              },
              duration: 10000
            }
          );
        }
        
        return true;
      } else {
        if (showToast) {
          toast({
            variant: "destructive",
            title: "Backend connection failed",
            description: data.message || "Could not connect to backend service",
          });
          
          if (data.is_html) {
            sonnerToast.error(
              "Received HTML instead of JSON response", 
              {
                description: "This typically happens when the request is hitting the frontend application instead of the backend API server.",
                duration: 10000
              }
            );
          }
        }
        
        if (data.suggested_backend_url && data.suggested_backend_url !== apiUrl) {
          sonnerToast.info(
            `A different backend URL might work better: ${data.suggested_backend_url}`, 
            {
              action: {
                label: 'Use this URL',
                onClick: () => {
                  setApiUrl(data.suggested_backend_url);
                  localStorage.setItem('diagnostics_api_url', data.suggested_backend_url);
                  checkBackendConnection();
                }
              },
              duration: 10000
            }
          );
        }
        
        return false;
      }
    } catch (error) {
      console.error("Backend connection check failed:", error);
      setIsBackendConnected(false);
      setBackendResult(null);
      
      if (showToast) {
        toast({
          variant: "destructive",
          title: "Backend connection failed",
          description: error instanceof Error ? error.message : "Unknown error occurred",
        });
      }
      
      return false;
    } finally {
      setIsTesting(false);
    }
  };

  const fetchDiagnosticData = async (endpoint: string) => {
    setIsLoading(true);
    
    const isConnected = await checkBackendConnection(false);
    
    if (!isConnected) {
      setResponse({
        status: 'error',
        message: 'Cannot connect to backend server',
        details: `The backend server appears to be offline or unreachable. Please make sure the FastAPI server is running at ${apiUrl}.`
      });
      
      setIsLoading(false);
      return;
    }
    
    try {
      const url = `${apiUrl}/diagnostic/${endpoint}`;
      console.log(`Fetching diagnostic data from: ${url}`);
      
      const response = await fetch(url, {
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
          'X-API-Request': 'true',
          'X-Backend-Request': 'true'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Data received from ${endpoint}:`, data);
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
        details: `The request to ${apiUrl}/diagnostic/${endpoint} failed. Check the console for more details.`
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
    } else if (value === 'backend-test') {
      checkBackendConnection(false);
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
    
    const isConnected = await checkBackendConnection(false);
    
    if (!isConnected) {
      toast({
        variant: "destructive",
        title: "Backend connection failed",
        description: `Cannot connect to the backend server at ${apiUrl}.`,
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const url = `${apiUrl}/diagnostic/book-extraction/${bookId}?title=${encodeURIComponent(bookTitle)}`;
      console.log(`Testing book extraction at: ${url}`);
      
      const response = await fetch(url, {
        mode: 'cors',
        headers: {
          'Accept': 'application/json',
          'X-API-Request': 'true',
          'X-Backend-Request': 'true'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Book extraction test response:', data);
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
        details: `The request to ${apiUrl}/diagnostic/book-extraction/${bookId} failed. Check the console for more details.`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiUrl(e.target.value);
  };

  const handleApiUrlSubmit = () => {
    localStorage.setItem('diagnostics_api_url', apiUrl);
    checkBackendConnection();
  };
  
  const toggleDebugMode = () => {
    setIsDebugMode(!isDebugMode);
    if (!isDebugMode) {
      toast({
        title: "Debug mode enabled",
        description: "Additional diagnostic information will be collected",
      });
    }
  };

  useEffect(() => {
    const savedApiUrl = localStorage.getItem('diagnostics_api_url');
    if (savedApiUrl) {
      setApiUrl(savedApiUrl);
    }
    
    checkBackendConnection(false);
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
        disabled={isTesting}
        className="ml-2"
      >
        {isTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
        Check Connection
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleDebugMode}
        className={isDebugMode ? "bg-amber-100 dark:bg-amber-900/20" : ""}
      >
        <Bug className="h-4 w-4 mr-2" />
        {isDebugMode ? "Debug On" : "Debug"}
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
          <div className="space-y-6">
            <div className="mb-6 p-4 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-md">
              <div className="flex items-start gap-3">
                <ServerCrash className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-800 dark:text-red-300">Backend Server Unavailable</h3>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    The diagnostics features require the FastAPI backend server to be running. 
                    Please ensure it's started and accessible at {apiUrl}.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => checkBackendConnection()}
                      disabled={isTesting}
                      className="border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
                    >
                      {isTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      Retry Connection
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
                    >
                      <Terminal className="h-4 w-4 mr-2" />
                      Start Backend (Coming Soon)
                    </Button>
                  </div>

                  <div className="mt-3 text-xs text-red-500 dark:text-red-400">
                    <strong>Common solutions:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Make sure the FastAPI server is running with <code>python -m backend.app.main</code></li>
                      <li>Check if the server is running on a different port (try 8080 instead of 8000)</li>
                      <li>Ensure there are no firewalls blocking the connection</li>
                      <li>Look for any error messages in the backend terminal</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 rounded-md">
              <h3 className="font-medium text-amber-800 dark:text-amber-300 mb-2">Configure Backend URL</h3>
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">
                If your backend is running on a different address, you can update it here:
              </p>
              <div className="flex gap-2">
                <Input 
                  value={apiUrl} 
                  onChange={handleApiUrlChange} 
                  placeholder="http://localhost:8000"
                  className="flex-1"
                />
                <Button onClick={handleApiUrlSubmit} disabled={isTesting}>
                  {isTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Update URL
                </Button>
              </div>
              
              <div className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                <strong>Try these URLs:</strong>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-1">
                  {["http://localhost:8000", "http://localhost:8080", "http://127.0.0.1:8000", "http://127.0.0.1:8080"].map((url) => (
                    <Button 
                      key={url} 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setApiUrl(url);
                        localStorage.setItem('diagnostics_api_url', url);
                        checkBackendConnection();
                      }}
                      className="text-xs h-7 border-amber-200 dark:border-amber-800"
                    >
                      {url}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-4">
            <TabsTrigger value="backend-test">Backend Test</TabsTrigger>
            <TabsTrigger value="directories">Directories</TabsTrigger>
            <TabsTrigger value="books">Books</TabsTrigger>
            <TabsTrigger value="selenium">Selenium Test</TabsTrigger>
            <TabsTrigger value="extraction">Book Extraction</TabsTrigger>
          </TabsList>
          
          <TabsContent value="backend-test" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Backend Connection Test</h3>
              <Button 
                size="sm" 
                onClick={() => checkBackendConnection()} 
                disabled={isTesting}
              >
                {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Test Connection
              </Button>
            </div>
            
            {backendResult && (
              <Card className="overflow-hidden border border-muted">
                <CardHeader className={`py-3 ${backendResult.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {backendResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      )}
                      <CardTitle className="text-base">
                        {backendResult.success ? 'Connection Successful' : 'Connection Failed'}
                      </CardTitle>
                    </div>
                    <Badge variant={backendResult.success ? 'default' : 'destructive'}>
                      {backendResult.response_status ? `Status: ${backendResult.response_status}` : 'No Response'}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm ml-7">
                    {backendResult.message}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="p-0">
                  <div className="p-4 border-b">
                    <h4 className="font-medium text-sm mb-2">Connection Details</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="font-medium text-muted-foreground">URL:</div>
                      <div className="font-mono text-xs overflow-hidden text-ellipsis">{backendResult.full_url}</div>
                      
                      <div className="font-medium text-muted-foreground">Content Type:</div>
                      <div>{backendResult.content_type || 'N/A'}</div>
                      
                      <div className="font-medium text-muted-foreground">Response Format:</div>
                      <div className="flex items-center gap-1">
                        {backendResult.is_json ? (
                          <>
                            <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            <span>JSON</span>
                          </>
                        ) : backendResult.is_html ? (
                          <>
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                            <span>HTML (expected JSON)</span>
                          </>
                        ) : (
                          <span>Unknown format</span>
                        )}
                      </div>
                      
                      {backendResult.server_info && (
                        <>
                          <div className="font-medium text-muted-foreground">Server:</div>
                          <div className="flex items-center gap-1">
                            <span>{backendResult.server_info.api_name || 'Unknown'}</span>
                            {backendResult.server_info.version && (
                              <span className="text-xs ml-1 text-muted-foreground">v{backendResult.server_info.version}</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {backendResult.response_preview && (
                    <div className="p-4">
                      <h4 className="font-medium text-sm mb-2">Response Preview</h4>
                      <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-40 whitespace-pre-wrap">
                        {backendResult.response_preview}
                      </pre>
                    </div>
                  )}
                  
                  {backendResult.debug_info && isDebugMode && (
                    <div className="p-4 border-t">
                      <h4 className="font-medium text-sm mb-2">Debug Information</h4>
                      <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-40 whitespace-pre-wrap">
                        {JSON.stringify(backendResult.debug_info, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {backendResult.is_html && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-amber-800 dark:text-amber-300">HTML Response Detected</h4>
                          <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                            The backend is returning HTML instead of JSON. This typically happens when:
                          </p>
                          <ul className="list-disc list-inside text-sm text-amber-600 dark:text-amber-400 mt-1 ml-1">
                            <li>The API request is being routed to the frontend application</li>
                            <li>The backend URL is incorrect or pointing to a web server</li>
                            <li>The API endpoint doesn't exist or is returning a web page</li>
                          </ul>
                          
                          <div className="mt-3 px-3 py-2 bg-amber-100 dark:bg-amber-900/40 rounded border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300">
                            <strong>Try adding these headers to your requests:</strong>
                            <pre className="mt-1 text-xs bg-amber-200/50 dark:bg-amber-800/50 p-1 rounded">
{`"X-API-Request": "true",
"X-Backend-Request": "true",
"Accept": "application/json"`}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {backendResult.suggested_backend_url && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800">
                      <div className="flex items-start gap-2">
                        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-blue-800 dark:text-blue-300">Suggested Backend URL</h4>
                          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                            A different backend URL might work better: <span className="font-mono">{backendResult.suggested_backend_url}</span>
                          </p>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="mt-2 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                            onClick={() => {
                              setApiUrl(backendResult.suggested_backend_url!);
                              localStorage.setItem('diagnostics_api_url', backendResult.suggested_backend_url!);
                              checkBackendConnection();
                            }}
                          >
                            Use This URL
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {!backendResult && !isTesting && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ServerCrash className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">No Connection Data</h3>
                <p className="text-muted-foreground max-w-md">
                  Click the "Test Connection" button to check the backend server connectivity.
                </p>
              </div>
            )}

            {isTesting && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Loader2 className="h-12 w-12 text-primary mb-4 animate-spin" />
                <h3 className="text-xl font-semibold mb-2">Testing Connection</h3>
                <p className="text-muted-foreground max-w-md">
                  Please wait while we test the connection to the backend server...
                </p>
              </div>
            )}
          </TabsContent>
          
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
                        <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-auto">
                          {JSON.stringify(response, null, 2)}
                        </pre>
                      )
                    )}
                    
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
