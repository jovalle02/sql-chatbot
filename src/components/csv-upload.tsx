// src/components/ui/csv-upload.tsx
import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, File, Check, X } from 'lucide-react';
import { uploadSingleFile, UploadResponse } from '@/lib/api';

interface CsvUploadProps {
  onUploadSuccess: (xmlString: string, fileName: string) => void;
  onUploadError: (error: string) => void;
  className?: string;
  disabled?: boolean;
}

export const CsvUpload: React.FC<CsvUploadProps> = ({
  onUploadSuccess,
  onUploadError,
  className = '',
  disabled = false
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;

    // Client-side validation (the API will also validate)
    if (!file.name.toLowerCase().endsWith('.csv')) {
      onUploadError('Please upload a CSV file');
      setHasError(true);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      onUploadError('File size must be less than 50MB');
      setHasError(true);
      return;
    }

    setIsUploading(true);
    setHasError(false);

    try {
      const result: UploadResponse = await uploadSingleFile(file);

      // Validate that we received the expected xmlString
      if (!result.xmlString) {
        throw new Error('Invalid response from server: missing XML data');
      }

      // Success handling
      setUploadedFile(file.name);
      onUploadSuccess(result.xmlString, file.name);
      
    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      onUploadError(errorMessage);
      setUploadedFile(null);
      setHasError(true);
    } finally {
      setIsUploading(false);
    }
  }, [onUploadSuccess, onUploadError]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  }, [disabled, isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled || isUploading) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [disabled, isUploading, handleFileUpload]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [handleFileUpload]);

  const handleClick = useCallback(() => {
    if (!disabled && !isUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled, isUploading]);

  const resetUpload = useCallback(() => {
    setUploadedFile(null);
    setHasError(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <div className={`relative ${className}`}>
      <motion.div
        className={`
          border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-300
          ${isDragging 
            ? 'border-blue-500 shadow-xl scale-105' 
            : hasError
              ? 'border-red-500 shadow-lg'
              : uploadedFile 
                ? 'border-green-500 shadow-lg'
                : 'border-gray-400 hover:border-gray-500 shadow-lg hover:shadow-xl'
          }
          ${disabled || isUploading ? 'cursor-not-allowed opacity-60' : 'hover:scale-102'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        whileHover={!disabled && !isUploading ? { scale: 1.02 } : {}}
        whileTap={!disabled && !isUploading ? { scale: 0.98 } : {}}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled || isUploading}
        />

        <AnimatePresence mode="wait">
          {isUploading ? (
            <motion.div
              key="uploading"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center space-y-6"
            >
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <div className="absolute inset-0 w-16 h-16 border-4 border-blue-200 rounded-full" />
              </div>
              <div>
                <p className="text-xl font-semibold text-gray-800">Uploading...</p>
                <p className="text-sm text-gray-600 mt-2">Processing your CSV file</p>
              </div>
            </motion.div>
          ) : hasError ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center space-y-6"
            >
              <div className="relative">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <X className="w-8 h-8 text-red-600" />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    resetUpload();
                  }}
                  className="absolute -top-2 -right-2 bg-gray-500 hover:bg-gray-600 text-white rounded-full p-1 transition-colors shadow-md"
                  title="Try again"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div>
                <p className="text-xl font-semibold text-red-700">Upload Failed</p>
                <p className="text-sm text-gray-600 mt-2">
                  Click to try again
                </p>
              </div>
            </motion.div>
          ) : uploadedFile ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center space-y-6"
            >
              <div className="relative">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    resetUpload();
                  }}
                  className="absolute -top-2 -right-2 bg-gray-500 hover:bg-gray-600 text-white rounded-full p-1 transition-colors shadow-md"
                  title="Upload another file"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div>
                <p className="text-xl font-semibold text-green-700">Upload Successful!</p>
                <p className="text-sm text-gray-700 mt-2 flex items-center justify-center space-x-2">
                  <File className="w-4 h-4" />
                  <span className="font-medium">{uploadedFile}</span>
                </p>
                <p className="text-xs text-gray-600 mt-3">
                  Data processed successfully
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center space-y-6"
            >
              <div className="w-16 h-16 bg-white-100 rounded-full flex items-center justify-center">
                <Upload className={`w-8 h-8 ${isDragging ? 'text-blue-500' : 'text-gray-500'}`} />
              </div>
              <div>
                <p className="text-xl font-semibold text-gray-800">
                  {isDragging ? 'Drop your CSV file here' : 'Choose CSV File'}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Drag and drop or click to browse
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};