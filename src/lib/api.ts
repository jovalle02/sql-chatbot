// src/lib/api.ts
import { ContentParser, SqlExecution, ThinkingBlock, InterruptedQuery, ContentBlock, GroupedContentBlock } from "./content-parser";
import { getGlobalTablesSchemaXml } from "./global-store";

export interface StreamChatRequest {
  message: string;
  userId: string;
  threadId: string;
  interrupt_policy: string;
  tables_schema_xml: string;
  chatModelSettings: {
    primary_model: string;
    secondary_model: string;
    max_tokens: number;
  };
}

// New interfaces for file upload
export interface UploadResponse {
  xmlString: string;
}

export interface UploadErrorResponse {
  error: string;
  details?: string;
}

// File upload function
export async function uploadFiles(
  files: File[]
): Promise<UploadResponse> {
  try {
    // Validate files before uploading
    if (files.length === 0) {
      throw new Error('No files provided');
    }

    // Validate file types
    const invalidFiles = files.filter(file => 
      !file.name.toLowerCase().endsWith('.csv')
    );
    
    if (invalidFiles.length > 0) {
      throw new Error(`Only CSV files are supported. Invalid files: ${invalidFiles.map(f => f.name).join(', ')}`);
    }

    // Validate file sizes (max 50MB per file)
    const maxSize = 50 * 1024 * 1024; // 50MB
    const oversizedFiles = files.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      throw new Error(`File(s) too large (max 50MB). Oversized files: ${oversizedFiles.map(f => f.name).join(', ')}`);
    }

    // Create FormData
    const formData = new FormData();
    
    // Add files to FormData
    files.forEach((file) => {
      formData.append('file', file);
    });

    // Use modern fetch API
    const response = await fetch('/api/data/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData: UploadErrorResponse = await response.json().catch(() => ({ 
        error: `Upload failed with status: ${response.status}` 
      }));
      throw new Error(errorData.error || `Upload failed with status: ${response.status}`);
    }

    const result: UploadResponse = await response.json();
    
    if (!result.xmlString) {
      throw new Error('Invalid response from server: missing xml');
    }

    return result;
  } catch (error) {
    console.error('Upload error:', error);
    throw error instanceof Error ? error : new Error('Upload failed');
  }
}

// Convenience function for single file upload
export async function uploadSingleFile(
  file: File
): Promise<UploadResponse> {
  return uploadFiles([file]);
}

export async function streamChatSSE(
  request: Omit<StreamChatRequest, 'tables_schema_xml'>,
  onChunk: (
    text: string, 
    thinking?: ThinkingBlock[], 
    sqlExecutions?: SqlExecution[], 
    hasNewSql?: boolean,
    isInterrupted?: boolean,
    interruptedQuery?: InterruptedQuery | null,
    contentBlocks?: ContentBlock[],
    groupedContentBlocks?: GroupedContentBlock[] // Add grouped blocks parameter
  ) => void,
  onError: (error: string) => void,
  onComplete: () => void
) {
  try {
    const tablesSchemaXml = getGlobalTablesSchemaXml();

    if (!tablesSchemaXml) {
      throw new Error('No CSV data available. Please upload a CSV file first.');
    }

    const completeRequest: StreamChatRequest = {
      ...request,
      tables_schema_xml: tablesSchemaXml
    };

    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(completeRequest),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No reader available');
    }

    const decoder = new TextDecoder();
    const parser = new ContentParser();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          onComplete();
          break;
        }

        // Decode the chunk and add to buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete lines
        const lines = buffer.split('\n\n'); // SSE uses double newlines as separators
        buffer = lines.pop() || ''; // Keep incomplete chunk in buffer

        for (const line of lines) {
          if (line.trim()) {
            const parsed = parser.parseChunk(line + '\n\n');
            
            // Pass the ThinkingBlock[] array directly to maintain structure
            const thinkingBlocks = parsed.thinking.length > 0 ? parsed.thinking : undefined;
            const contentBlocks = parsed.contentBlocks.length > 0 ? parsed.contentBlocks : undefined;
            const groupedContentBlocks = parsed.groupedContentBlocks.length > 0 ? parsed.groupedContentBlocks : undefined;
            
            onChunk(
              parsed.text, 
              thinkingBlocks, 
              parsed.sqlExecutions, 
              parsed.hasNewSql,
              parsed.isInterrupted,
              parsed.interruptedQuery,
              contentBlocks,
              groupedContentBlocks // Pass grouped content blocks
            );
            
            // If interrupted, break out of the loop
            if (parsed.isInterrupted) {
              onComplete();
              return;
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming error:', error);
      onError(error instanceof Error ? error.message : 'Unknown streaming error');
    }
  } catch (error) {
    console.error('Failed to start stream:', error);
    onError(error instanceof Error ? error.message : 'Failed to start stream');
  }
}

// New interface for query execution request
export interface ExecuteQueryRequest {
  query: string;
  reason: string;
  chat_model_settings: {
    primary_model: string;
    secondary_model: string;
    max_tokens: number;
  };
}

// New function for executing queries directly (used after interrupt resume)
export async function executeQuerySSE(
  request: Omit<ExecuteQueryRequest, 'tables_schema_xml'>,
  userId: string,
  threadId: string,
  targetSqlId: string | undefined,
  onChunk: (
    text: string, 
    thinking?: ThinkingBlock[], 
    sqlExecutions?: SqlExecution[], 
    hasNewSql?: boolean,
    isInterrupted?: boolean,
    interruptedQuery?: InterruptedQuery | null,
    contentBlocks?: ContentBlock[],
    groupedContentBlocks?: GroupedContentBlock[]
  ) => void,
  onError: (error: string) => void,
  onComplete: () => void
) {
  try {
    const tablesSchemaXml = getGlobalTablesSchemaXml();
    
    if (!tablesSchemaXml) {
      throw new Error('No CSV data available. Please upload a CSV file first.');
    }

    const completeRequest = {
      ...request,
      tables_schema_xml: tablesSchemaXml,
      userId,
      threadId
    };

    const response = await fetch('/api/chat/stream/resume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(completeRequest),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No reader available');
    }

    const decoder = new TextDecoder();
    const parser = new ContentParser();
    
    // Set the target SQL ID for resume scenarios
    if (targetSqlId) {
      parser.setResumeTargetSqlId(targetSqlId);
    }
    
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          onComplete();
          break;
        }

        // Decode the chunk and add to buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Process complete lines
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            const parsed = parser.parseChunk(line + '\n\n');
            
            const thinkingBlocks = parsed.thinking.length > 0 ? parsed.thinking : undefined;
            const contentBlocks = parsed.contentBlocks.length > 0 ? parsed.contentBlocks : undefined;
            const groupedContentBlocks = parsed.groupedContentBlocks.length > 0 ? parsed.groupedContentBlocks : undefined;
            
            onChunk(
              parsed.text, 
              thinkingBlocks, 
              parsed.sqlExecutions, 
              parsed.hasNewSql,
              parsed.isInterrupted,
              parsed.interruptedQuery,
              contentBlocks,
              groupedContentBlocks
            );
            
            if (parsed.isInterrupted) {
              onComplete();
              return;
            }
          }
        }
      }
    } catch (error) {
      console.error('Query execution streaming error:', error);
      onError(error instanceof Error ? error.message : 'Unknown streaming error');
    }
  } catch (error) {
    console.error('Failed to start query execution stream:', error);
    onError(error instanceof Error ? error.message : 'Failed to start query execution stream');
  }
}

export { ContentParser };