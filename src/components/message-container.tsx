// src/types/message.ts
import { ThinkingBlock, ContentBlock, GroupedContentBlock } from '@/lib/content-parser';

interface InterruptedQuery {
  id: string;
  query: string;
  purpose?: string;
  originalQuery: string; // Keep track of original for comparison
}

interface Message {
  id: string;
  content: string;
  thinking?: ThinkingBlock[];
  contentBlocks?: ContentBlock[];
  groupedContentBlocks?: GroupedContentBlock[];
  type: 'user' | 'bot';
  timestamp: Date;
  isInterrupted?: boolean;
  interruptedQuery?: InterruptedQuery;
  canEditQuery?: boolean;
  threadId?: string;
}

// src/components/message-container.tsx
import React from 'react';

interface MessageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const MessageContainer: React.FC<MessageContainerProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <div className={`overflow-y-auto space-y-4 p-4 ${className}`}>
      {children}
    </div>
  );
};

export type { Message, InterruptedQuery };