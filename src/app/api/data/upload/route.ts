// app/api/data/upload/route.ts
import { NextRequest } from 'next/server';

// Define the interface for the upload response
interface UploadResponse {
  xmlString: string;
}

// Define the interface for error response
interface ErrorResponse {
  error: string;
  details?: string;
}

// Function to upload files to your custom AI service
async function uploadFilesToCustomAI(
  files: File[]
): Promise<UploadResponse> {
  try {
    // Create FormData to send files
    const formData = new FormData();
    
    // Add each file to the form data
    files.forEach((file, index) => {
      formData.append('files', file);
    });

    // Upload to your custom AI endpoint
    const apiUrl = `${process.env.YOUR_CUSTOM_AI_ENDPOINT}/v1/api/data/upload`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.YOUR_API_KEY}`,
        // Note: Don't set Content-Type for FormData, let the browser set it with boundary
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${response.statusText}: ${errorText}`);
    }

    const result = await response.json();
    return {
        xmlString: result?.tables_schema_xml
    };

  } catch (error) {
    console.error('Error uploading to custom AI:', error);
    throw error;
  }
}

// Main API route handler
export async function POST(request: NextRequest) {
  try {
    // Parse the multipart form data
    const formData = await request.formData();
    
    // Extract files from form data
    const fileEntries = formData.getAll('file') as File[];
    const filesEntries = formData.getAll('files') as File[];
    
    // Combine both 'file' and 'files' entries
    const allFiles = [...fileEntries, ...filesEntries].filter(
      (file): file is File => file instanceof File && file.size > 0
    );

    // Validate that we have files
    if (allFiles.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No files provided',
          details: 'Please upload at least one file'
        } satisfies ErrorResponse), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate file types (CSV only for now)
    const invalidFiles = allFiles.filter(file => 
      !file.name.toLowerCase().endsWith('.csv')
    );
    
    if (invalidFiles.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid file type(s)',
          details: `Only CSV files are supported. Invalid files: ${invalidFiles.map(f => f.name).join(', ')}`
        } satisfies ErrorResponse), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate file sizes (max 50MB per file)
    const maxSize = 50 * 1024 * 1024; // 50MB
    const oversizedFiles = allFiles.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: 'File(s) too large',
          details: `Maximum file size is 50MB. Oversized files: ${oversizedFiles.map(f => f.name).join(', ')}`
        } satisfies ErrorResponse), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Upload files to your custom AI service
    const uploadResult = await uploadFilesToCustomAI(allFiles);

    // Return success response
    return new Response(
      JSON.stringify(uploadResult satisfies UploadResponse), 
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          // Enable CORS if needed
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );

  } catch (error) {
    console.error('Upload API route error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to upload files',
        details: errorMessage
      } satisfies ErrorResponse), 
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