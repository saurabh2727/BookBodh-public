
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { uploadBook } from '@/services/api';

interface BookUploadProps {
  onUploadComplete?: (success: boolean, message: string) => void;
  onClose?: () => void;
}

const BookUpload: React.FC<BookUploadProps> = ({ onUploadComplete, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
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

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = Math.min(prev + 10, 90);
          return newProgress;
        });
      }, 300);
      
      // Call our uploadBook function from the API
      const response = await uploadBook(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (response.success) {
        toast({
          title: "Upload Successful",
          description: response.message || "Book uploaded successfully!",
        });
        if (onUploadComplete) {
          onUploadComplete(true, response.message);
        }
        setFile(null);
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
      
      <CardContent>
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
        
        {isUploading && (
          <div className="mt-4 space-y-2">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">
              Uploading and processing book... {uploadProgress}%
            </p>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          onClick={handleUpload} 
          disabled={!file || isUploading}
          className="flex items-center gap-2"
        >
          {isUploading ? 'Processing...' : 'Upload Book'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default BookUpload;
