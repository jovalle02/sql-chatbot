// src/lib/api.ts
import { ContentParser, SqlExecution, ThinkingBlock, InterruptedQuery, ContentBlock, GroupedContentBlock } from "./content-parser";

export interface StreamChatRequest {
  message: string;
  userId: string;
  threadId: string;
  interrupt_policy: string;
  chatModelSettings: {
    primary_model: string;
    secondary_model: string;
    max_tokens: number;
  };
}

export async function streamChatSSE(
  request: StreamChatRequest,
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
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
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
  request: ExecuteQueryRequest,
  userId: string,
  threadId: string,
  targetSqlId: string | undefined, // Add this parameter
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
    const response = await fetch('/api/chat/stream/resume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...request,
        userId,
        threadId
      }),
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