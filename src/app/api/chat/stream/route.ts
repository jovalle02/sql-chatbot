// app/api/chat/stream/route.ts
import { NextRequest } from 'next/server';

// Define the interface for chat model settings
interface ChatModelSettings {
  primary_model: string;
  secondary_model: string;
  max_tokens: number;
}

// Your custom AI streaming function
async function streamToCustomAI(
  message: string, 
  controller: ReadableStreamDefaultController,
  userId: string,
  threadId: string,
  interruptPolicy: string,
  chatModelSettings: ChatModelSettings,
  tablesSchemaXml: string // Add this parameter
) {
  const encoder = new TextEncoder();
  
  try {
    // Build the URL with user_id and thread_id
    const apiUrl = `${process.env.YOUR_CUSTOM_AI_ENDPOINT}/v1/api/stream/${userId}/${threadId}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.YOUR_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message,
        interrupt_policy: interruptPolicy,
        tables_schema_xml: tablesSchemaXml, // Include the XML schema
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
      // Assuming your API returns raw text chunks or JSON chunks
      if (chunk.trim()) {
        try {
          // Try to parse as JSON first (in case your API returns structured data)
          const parsed = JSON.parse(chunk);
          const content = parsed.content || parsed.text || parsed.message || chunk;
          
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
          );
        } catch {
          // If not JSON, treat as raw text
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`)
          );
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    controller.enqueue(
      encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`)
    );
    controller.close();
  }
}

// Define the interface for the request body
interface RequestBody {
  message: string;
  userId?: string;
  threadId?: string;
  interrupt_policy?: string;
  tables_schema_xml: string; // Now required
  chatModelSettings?: ChatModelSettings;
}

// Main API route handler
export async function POST(request: NextRequest) {
  try {
    const { 
      message, 
      userId, 
      threadId, 
      interrupt_policy,
      tables_schema_xml,
      chatModelSettings
    }: RequestBody = await request.json();

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (!tables_schema_xml || typeof tables_schema_xml !== 'string') {
      return new Response(
        JSON.stringify({ error: 'tables_schema_xml is required' }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Use provided values or defaults
    const finalUserId = userId || 'default-user';
    const finalThreadId = threadId || `thread-${Date.now()}`;
    const finalInterruptPolicy = interrupt_policy || 'never';
    const finalChatModelSettings: ChatModelSettings = chatModelSettings || {
      primary_model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
      secondary_model: "us.anthropic.claude-opus-4-20250514-v1:0",
      max_tokens: 16384
    };

    // Create the streaming response
    const stream = new ReadableStream({
      async start(controller) {
        await streamToCustomAI(
          message, 
          controller, 
          finalUserId, 
          finalThreadId,
          finalInterruptPolicy,
          finalChatModelSettings,
          tables_schema_xml // Pass the XML schema
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
    console.error('API route error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process request',
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
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}