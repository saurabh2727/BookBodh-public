
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, AlertCircle, BookIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadBook } from '@/services/api';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { z } from 'zod';

interface BookUploadProps {
  onUploadComplete?: (success: boolean, message: string, bookId?: string) => void;
  onClose?: () => void;
}

// Book metadata validation schema
const bookSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  author: z.string().min(1, 'Author is required'),
  category: z.enum(['Fiction', 'Non-Fiction', 'Philosophy', 'Science', 'History'])
});

const BookUpload: React.FC<BookUploadProps> = ({ onUploadComplete, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF file.",
        variant: "destructive"
      });
      return;
    }
    
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB.",
        variant: "destructive"
      });
      return;
    }
    
    setFile(selectedFile);
    
    // Try to extract title and author from filename
    const filename = selectedFile.name.replace('.pdf', '');
    const parts = filename.split(' - ');
    
    if (parts.length >= 2 && !title) {
      // If filename looks like "Author - Title.pdf"
      setAuthor(parts[0]);
      setTitle(parts.slice(1).join(' - '));
    } else if (!title) {
      // Just use the filename as the title
      setTitle(filename);
    }
  };

  const validateForm = () => {
    try {
      bookSchema.parse({ title, author, category });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a PDF file to upload.",
        variant: "destructive"
      });
      return;
    }
    
    if (!validateForm()) {
      toast({
        title: "Invalid form data",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = Math.min(prev + 5, 90);
          return newProgress;
        });
      }, 300);
      
      // Call our uploadBook function from the API
      const response = await uploadBook(file, title, author, category);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (response.success) {
        toast({
          title: "Upload Successful",
          description: response.message || "Book uploaded successfully!",
        });
        if (onUploadComplete) {
          onUploadComplete(true, response.message, response.bookId);
        }
        setFile(null);
        setTitle('');
        setAuthor('');
        setCategory('');
      } else {
        toast({
          title: "Upload Failed",
          description: response.message || "Failed to upload book.",
          variant: "destructive"
        });
        if (onUploadComplete) {
          onUploadComplete(false, response.message);
        }
      }
    } catch (error) {
      toast({
        title: "Upload Error",
        description: error.message || "An error occurred during upload. Please try again.",
        variant: "destructive"
      });
      if (onUploadComplete) {
        onUploadComplete(false, error.message || "Network error occurred");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          <span>Upload Book</span>
        </CardTitle>
        <CardDescription>
          Upload a PDF book to chat about its content
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center ${
            dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/20'
          } transition-colors`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf"
            onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
          />
          
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-10 w-10 text-primary" />
              <p className="font-medium text-sm">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Drag & drop your PDF here</p>
              <p className="text-sm text-muted-foreground">or</p>
              <Button variant="secondary" size="sm" onClick={triggerFileInput}>
                Browse Files
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Maximum file size: 10MB
              </p>
            </div>
          )}
        </div>
        
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="title">Book Title</Label>
            <Input 
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter book title"
              disabled={isUploading}
              className={errors.title ? "border-destructive" : ""}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title}</p>
            )}
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="author">Author</Label>
            <Input 
              id="author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Enter author name"
              disabled={isUploading}
              className={errors.author ? "border-destructive" : ""}
            />
            {errors.author && (
              <p className="text-xs text-destructive">{errors.author}</p>
            )}
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="category">Category</Label>
            <Select
              value={category}
              onValueChange={setCategory}
              disabled={isUploading}
            >
              <SelectTrigger className={errors.category ? "border-destructive" : ""}>
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
            {errors.category && (
              <p className="text-xs text-destructive">{errors.category}</p>
            )}
          </div>
        </div>
        
        {isUploading && (
          <div className="mt-4 space-y-2">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">
              {uploadProgress < 100 
                ? `Uploading and processing book... ${uploadProgress}%`
                : "Processing complete! Finalizing..."
              }
            </p>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onClose} disabled={isUploading}>
          Cancel
        </Button>
        <Button 
          onClick={handleUpload} 
          disabled={!file || isUploading || !title || !author || !category}
          className="flex items-center gap-2"
        >
          {isUploading ? 'Processing...' : 'Upload Book'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default BookUpload;
