// src/app/api/chat/stream/resume/route.ts
import { NextRequest } from 'next/server';

// TypeScript interfaces
interface ChatModelSettings {
  primary_model: string;
  secondary_model: string;
  max_tokens: number;
}

interface QueryExecuteRequest {
  query: string;
  reason: string;
  chat_model_settings?: ChatModelSettings;
  userId?: string;
  threadId?: string;
}

interface APIResponse {
  content?: string;
  text?: string;
  message?: string;
  error?: string;
}

interface StreamData {
  content?: string;
  error?: string;
}

// Query execution streaming function
async function streamQueryExecution(
  query: string,
  reason: string,
  chatModelSettings: ChatModelSettings,
  controller: ReadableStreamDefaultController,
  userId: string,
  threadId: string
): Promise<void> {
  const encoder = new TextEncoder();
  
  try {
    // Build the URL with user_id and thread_id for query execution endpoint
    const apiUrl = `${process.env.YOUR_CUSTOM_AI_ENDPOINT}/v1/api/stream/${userId}/${threadId}/resume`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.YOUR_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        reason,
        chat_model_settings: {
          primary_model: chatModelSettings.primary_model,
          secondary_model: chatModelSettings.secondary_model,
          max_tokens: chatModelSettings.max_tokens
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} - ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No reader available');
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        break;
      }

      const chunk = decoder.decode(value);
      
      // Handle your API's streaming format
      if (chunk.trim()) {
        try {
          // Try to parse as JSON first (in case your API returns structured data)
          const parsed: APIResponse = JSON.parse(chunk);
          const content = parsed.content || parsed.text || parsed.message || chunk;
          
          const streamData: StreamData = { content };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(streamData)}\n\n`)
          );
        } catch {
          // If not JSON, treat as raw text
          const streamData: StreamData = { content: chunk };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(streamData)}\n\n`)
          );
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const streamData: StreamData = { error: errorMessage };
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify(streamData)}\n\n`)
    );
    controller.close();
  }
}

// Main API route handler
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Extract parameters from request
    const requestData: QueryExecuteRequest = await request.json();
    const { 
      query,
      reason,
      chat_model_settings,
      userId, 
      threadId 
    } = requestData;

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required' }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (!reason || typeof reason !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Reason is required' }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Use provided values or defaults
    const finalUserId = userId || 'default-user';
    const finalThreadId = threadId || `thread-${Date.now()}`;
    const finalChatModelSettings: ChatModelSettings = chat_model_settings || {
      primary_model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
      secondary_model: "us.anthropic.claude-opus-4-20250514-v1:0",
      max_tokens: 16384
    };

    // Create the streaming response
    const stream = new ReadableStream({
      async start(controller) {
        await streamQueryExecution(
          query,
          reason,
          finalChatModelSettings,
          controller,
          finalUserId,
          finalThreadId
        );
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        // Enable CORS if needed
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Query execution API route error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process query execution request',
        details: errorMessage
      }), 
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Handle preflight requests for CORS
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}