import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle, Check } from 'lucide-react';
import { uploadBook } from '@/services/api';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface BookUploadProps {
  onClose: () => void;
  onUploadComplete: (success: boolean, message: string, bookId?: string) => void;
}

const BookUpload: React.FC<BookUploadProps> = ({ onUploadComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState<string>('Non-Fiction');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailedError, setDetailedError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [bookId, setBookId] = useState<string | null>(null);
  const [chunksCount, setChunksCount] = useState<number | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    
    if (selectedFile) {
      console.log(`Selected file: ${selectedFile.name}, size: ${selectedFile.size}, type: ${selectedFile.type}`);
      
      // Validate file is a PDF
      if (!selectedFile.type.includes('pdf') && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
        setError('Please select a PDF file');
        setFile(null);
        return;
      }
      
      setFile(selectedFile);
      setError(null);
      setDetailedError(null);
      setUploadSuccess(false);
      setBookId(null);
      setChunksCount(null);
      
      // Try to extract title from filename if not set
      if (!title) {
        const filename = selectedFile.name.replace(/\.[^/.]+$/, ""); // Remove extension
        const cleanedTitle = filename
          .replace(/[_-]/g, " ")   // Replace underscores and dashes with spaces
          .replace(/\s{2,}/g, " ") // Replace multiple spaces with a single space
          .trim();                 // Remove leading and trailing spaces
        
        setTitle(cleanedTitle);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file');
      return;
    }
    
    if (!title) {
      setError('Title is required');
      return;
    }
    
    if (!author) {
      setError('Author is required');
      return;
    }
    
    try {
      setIsUploading(true);
      setError(null);
      setDetailedError(null);
      setUploadSuccess(false);
      setBookId(null);
      setChunksCount(null);
      
      console.log('Uploading book with details:', {
        title,
        author,
        category,
        fileSize: file.size,
        fileType: file.type
      });
      
      const result = await uploadBook(file, title, author, category);
      
      console.log('Upload result:', result);
      
      if (result.success) {
        setUploadSuccess(true);
        setBookId(result.bookId || null);
        setChunksCount(result.chunksCount || null);
        
        // Enhanced success message with book ID and chunks count
        let successMessage = `Book "${title}" uploaded successfully`;
        if (result.bookId) {
          successMessage += `, ID: ${result.bookId}`;
        }
        if (result.chunksCount) {
          successMessage += `, ${result.chunksCount} chunks created`;
        }
        
        onUploadComplete(true, successMessage, result.bookId);
      } else {
        setError(result.message || 'Upload failed. Please try again.');
        onUploadComplete(false, result.message || 'Upload failed. Please try again.');
      }
    } catch (error) {
      console.error('Error uploading book:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError('Upload failed. Please try again.');
      setDetailedError(errorMessage);
      onUploadComplete(false, errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="file">PDF File</Label>
        <Input 
          id="file" 
          type="file" 
          onChange={handleFileChange} 
          accept="application/pdf,.pdf"
          className="mt-1"
          disabled={isUploading || uploadSuccess}
        />
        {!file && <p className="text-xs text-muted-foreground mt-1">Select a PDF file to upload</p>}
        {file && <p className="text-xs text-muted-foreground mt-1">Selected: {file.name}</p>}
      </div>
      
      <div>
        <Label htmlFor="title">Title</Label>
        <Input 
          id="title" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Book title"
          className="mt-1"
          disabled={isUploading || uploadSuccess}
        />
      </div>
      
      <div>
        <Label htmlFor="author">Author</Label>
        <Input 
          id="author" 
          value={author} 
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Author name"
          className="mt-1"
          disabled={isUploading || uploadSuccess}
        />
      </div>
      
      <div>
        <Label htmlFor="category">Category</Label>
        <Select 
          defaultValue="Non-Fiction" 
          value={category} 
          onValueChange={setCategory}
          disabled={isUploading || uploadSuccess}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Fiction">Fiction</SelectItem>
            <SelectItem value="Non-Fiction">Non-Fiction</SelectItem>
            <SelectItem value="Philosophy">Philosophy</SelectItem>
            <SelectItem value="Science">Science</SelectItem>
            <SelectItem value="History">History</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error}
            {detailedError && (
              <details className="mt-2 text-xs">
                <summary>Technical details</summary>
                <pre className="mt-2 w-full overflow-auto text-xs whitespace-pre-wrap">
                  {detailedError}
                </pre>
              </details>
            )}
          </AlertDescription>
        </Alert>
      )}
      
      {uploadSuccess && (
        <Alert variant="default" className="bg-green-50 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Success</AlertTitle>
          <AlertDescription className="text-green-700">
            Book "{title}" uploaded successfully!
            {bookId && (
              <div className="mt-1 text-xs">
                Book ID: <span className="font-mono">{bookId}</span>
              </div>
            )}
            {chunksCount && (
              <div className="text-xs">
                Chunks created: {chunksCount}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
      
      <div className="flex justify-end gap-2 pt-2">
        <Button 
          type="submit" 
          disabled={isUploading || uploadSuccess}
          className="gap-2"
        >
          {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isUploading ? 'Uploading...' : uploadSuccess ? 'Uploaded Successfully' : 'Upload Book'}
        </Button>
      </div>
    </form>
  );
};

export default BookUpload;
