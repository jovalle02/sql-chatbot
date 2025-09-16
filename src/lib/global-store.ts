// src/lib/global-store.ts

// Global variable to store the XML schema
let globalTablesSchemaXml: string | null = null;

// Helper function to get the current XML schema
export const getGlobalTablesSchemaXml = (): string | null => globalTablesSchemaXml;

// Helper function to set the XML schema (called after successful upload)
export const setGlobalTablesSchemaXml = (xml: string | null): void => {
  globalTablesSchemaXml = xml;
};

// Helper function to check if XML is available
export const hasTablesSchemaXml = (): boolean => {
  return globalTablesSchemaXml !== null && globalTablesSchemaXml.trim() !== '';
};

// Helper function to clear the XML (when user uploads new file or resets)
export const clearGlobalTablesSchemaXml = (): void => {
  globalTablesSchemaXml = null;
};

// Global variable to store the upload ID
let globalUploadId: string | null = null;

// Helper function to get the current upload ID
export const getGlobalUploadId = (): string | null => globalUploadId;

// Helper function to set the upload ID (for use in API calls)
export const setGlobalUploadId = (uploadId: string | null): void => {
  globalUploadId = uploadId;
};