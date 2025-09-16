//page.tsx
"use client"

import ChatBot from "@/components/chatbot";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SqlExecution } from "@/lib/content-parser";
import { AlertCircle } from "lucide-react";
import { CsvUpload } from "@/components/csv-upload";
import { SqlPanel } from "@/components/sql-panel";
import { setGlobalTablesSchemaXml, clearGlobalTablesSchemaXml } from "@/lib/global-store";

// Global variable to store the upload ID
let globalUploadId: string | null = null;

export default function Home() {
  const [isSqlPanelOpen, setIsSqlPanelOpen] = useState(false);
  const [sqlExecutions, setSqlExecutions] = useState<SqlExecution[]>([]);
  const [isFileUploaded, setIsFileUploaded] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadError, setUploadError] = useState<string>('');

  // State to hold ChatBot's exposed handlers
  const [sqlHandlers, setSqlHandlers] = useState<{
    edit: (id: string, query: string, purpose: string) => void;
    resume: (id: string) => Promise<void>;
  } | null>(null);

  const handleUploadSuccess = (xmlString: string, fileName: string) => {
    // Store XML globally for use in API calls
    setGlobalTablesSchemaXml(xmlString);
    
    setIsFileUploaded(true);
    setUploadedFileName(fileName);
    setUploadError('');
  };

  const handleUploadError = (error: string) => {
    // Clear global XML on error
    clearGlobalTablesSchemaXml();
    
    globalUploadId = null;
    setIsFileUploaded(false);
    setUploadedFileName('');
    setUploadError(error);
    
    console.error('CSV upload error:', error);
  };

  return (
    <main className="h-screen bg-gray-50 flex overflow-hidden relative">
      {/* ChatBot */}
      <motion.div
        className={`flex items-center justify-center p-4 h-full min-h-0 ${!isFileUploaded ? 'pointer-events-none' : ''}`}
        animate={{
          width: isSqlPanelOpen ? "70%" : "100%",
        }}
        transition={{
          duration: 0.4,
          ease: [0.4, 0, 0.2, 1]
        }}
      >
        <div className="w-full max-w-4xl h-full flex flex-col min-h-0">
          <ChatBot
            className="h-full"
            title="How can I help you analyze your data?"
            subtitle="Upload a CSV file to get started with AI-powered data analysis"
            onSqlPanelToggle={setIsSqlPanelOpen}
            isSqlPanelOpen={isSqlPanelOpen}
            sqlExecutions={sqlExecutions}
            setSqlExecutions={setSqlExecutions}
            onExposeHandlers={setSqlHandlers}
          />
        </div>
      </motion.div>

      {/* Upload Overlay - Simple Black and White Design */}
      <AnimatePresence>
        {!isFileUploaded && (
          <>
            {/* Simple Black Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                delay: 0.5,
                duration: 0.5,
                ease: [0.4, 0, 0.2, 1]
              }}
              className="absolute inset-0 bg-black/80 z-40"
            />
            
            {/* Simple Upload Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                delay: 0.5,
                duration: 0.3,
                ease: [0.4, 0, 0.2, 1]
              }}
              className="absolute inset-0 flex items-center justify-center z-50 p-6"
              style={{ pointerEvents: 'auto' }}
            >
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-9 space-y-4 max-w-md w-full">
                {/* Simple Header */}
                <div className="text-center">
                  <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                    Upload CSV File
                  </h1>
                  <p className="text-gray-600">
                    To get started, please upload a CSV file containing the data you would like to analyze.
                  </p>
                </div>

                {/* Upload Error Display */}
                {uploadError && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-3 flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Error</h3>
                      <p className="text-sm text-gray-700 mt-1">{uploadError}</p>
                    </div>
                  </div>
                )}

                {/* CSV Upload Component */}
                <CsvUpload
                  onUploadSuccess={handleUploadSuccess}
                  onUploadError={handleUploadError}
                  className="w-full"
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* File Upload Status (when file is uploaded) */}
      <AnimatePresence>
        {isFileUploaded && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg p-3 shadow-sm z-20"
          >
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-gray-900 rounded-full"></div>
              <span className="text-sm font-medium text-gray-900">
                {uploadedFileName} • Ready
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SQL Panel Container - only show if file is uploaded */}
      <AnimatePresence>
        {isSqlPanelOpen && isFileUploaded && (
          <motion.div
            className="bg-white border-l border-gray-200 shadow-xl"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "50%", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{
              duration: 0.4,
              ease: [0.4, 0, 0.2, 1]
            }}
          >
            <SqlPanel
              isOpen={true}
              onClose={() => setIsSqlPanelOpen(false)}
              sqlExecutions={sqlExecutions}
              className="h-full"
              onQueryEdit={sqlHandlers?.edit}
              onQueryResume={sqlHandlers?.resume}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}