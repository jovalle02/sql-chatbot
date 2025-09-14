// src/components/ui/bot-message.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Thinking } from './thinking';
import type { Components } from 'react-markdown';
import { ThinkingBlock, InterruptedQuery, ContentBlock, GroupedContentBlock } from '@/lib/content-parser';

interface BotMessageProps {
  message: string;
  thinking?: ThinkingBlock[];
  contentBlocks?: ContentBlock[];
  groupedContentBlocks?: GroupedContentBlock[]; // new prop for grouped blocks
  timestamp?: Date;
  isStreaming?: boolean;
  showThinking?: boolean;
  // When true, show the disclaimer line (used for the latest, completed bot message)
  showDisclaimer?: boolean;
  
  // Interrupt handling props
  isInterrupted?: boolean;
  interruptedQuery?: InterruptedQuery;
  canEditQuery?: boolean;
}

export const BotMessage: React.FC<BotMessageProps> = ({ 
  message, 
  thinking, 
  contentBlocks,
  groupedContentBlocks, // Use grouped blocks if available
  timestamp, 
  isStreaming = false,
  showThinking = true,
  showDisclaimer = false,
  isInterrupted = false,
  interruptedQuery,
  canEditQuery = false
}) => {

  const markdownComponents: Components = {
    table: ({ children }) => (
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600 my-2">
          {children}
        </table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-left font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
        {children}
      </td>
    ),
    code: ({ children, className, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      const isInline = !match;
      
      if (isInline) {
        return (
          <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm font-mono" {...props}>
            {children}
          </code>
        );
      }
      
      return (
        <pre className="bg-gray-900 text-gray-100 p-3 rounded-md overflow-x-auto">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      );
    },
    h1: ({ children }) => (
      <h1 className="text-xl font-bold mb-2 mt-4 first:mt-0">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-base font-bold mb-1 mt-2 first:mt-0">{children}</h3>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-outside pl-6 my-2 space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-outside pl-6 my-2 space-y-1">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="ml-0">{children}</li>
    ),
    p: ({ children }) => (
      <p className="mb-2 last:mb-0">{children}</p>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-2">
        {children}
      </blockquote>
    ),
    a: ({ children, href }) => (
      <a 
        href={href} 
        className="text-blue-600 dark:text-blue-400 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    // Customize strong/bold text
    strong: ({ children }) => (
      <strong className="font-bold">{children}</strong>
    ),
    // Customize emphasis/italic text
    em: ({ children }) => (
      <em className="italic">{children}</em>
    ),
  };

  // Render grouped content blocks
  const renderGroupedContentBlock = (groupedBlock: GroupedContentBlock, index: number) => {
    if (groupedBlock.type === 'thinking') {
      return (
        <div key={`${groupedBlock.id}-${index}`} className="mb-2">
          <Thinking
            groupedContentBlocks={[groupedBlock]} // Pass the grouped block to the Thinking component
            isStreaming={isStreaming && index === groupedContentBlocks!.length - 1}
            defaultExpanded={true}
          />
        </div>
      );
    } else if (groupedBlock.type === 'text') {
      return (
        <div 
          key={`${groupedBlock.id}-${index}`} 
          className="rounded-2xl rounded-tl-md px-4 py-3 shadow-sm bg-gray-100 dark:bg-gray-800 mb-2"
        >
          <div className="text-sm leading-relaxed text-gray-800 dark:text-gray-200 prose prose-sm prose-gray dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {typeof groupedBlock.content === 'string' ? groupedBlock.content : ''}
            </ReactMarkdown>
          </div>
        </div>
      );
    }
    return null;
  };

  // Legacy function for individual content blocks (kept for backward compatibility)
  const renderContentBlock = (block: ContentBlock, index: number) => {
    if (block.type === 'thinking') {
      // Convert ContentBlock to ThinkingBlock format for existing Thinking component
      const thinkingBlock: ThinkingBlock = {
        id: block.id,
        content: block.content,
        timestamp: block.timestamp
      };
      
      return (
        <div key={`${block.id}-${index}`} className="mb-2">
          <Thinking
            thinking={[thinkingBlock]}
            isStreaming={isStreaming && index === contentBlocks!.length - 1}
            defaultExpanded={block.content.length <= 100}
          />
        </div>
      );
    } else if (block.type === 'text') {
      return (
        <div 
          key={`${block.id}-${index}`} 
          className="rounded-2xl rounded-tl-md px-4 py-3 shadow-sm bg-gray-100 dark:bg-gray-800 mb-2"
        >
          <div className="text-sm leading-relaxed text-gray-800 dark:text-gray-200 prose prose-sm prose-gray dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {block.content}
            </ReactMarkdown>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <motion.div 
      className="flex justify-start mb-4"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-[80%] space-y-2">
        {/* Interrupt Alert with Smooth Exit Animation */}
        <AnimatePresence>
          {isInterrupted && interruptedQuery && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ 
                opacity: 0, 
                scale: 0.95,
                transition: { 
                  duration: 0.2,
                  ease: [0.4, 0, 0.2, 1]
                }
              }}
              transition={{ 
                duration: 0.3, 
                ease: [0.4, 0, 0.2, 1] 
              }}
              className="bg-gray-100 border border-gray-300 rounded-lg p-4 shadow-sm"
            >
              <div className="flex items-center space-x-3">
                {/* Loading Spinner */}
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                
                <p className="text-sm text-gray-700">
                  Response interrupted. You can edit the SQL query and purpose in the SQL panel and resume the conversation.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Render grouped content blocks if available (preferred) */}
        {groupedContentBlocks && groupedContentBlocks.length > 0 ? (
          <div className="space-y-2">
            {groupedContentBlocks.map((groupedBlock, index) => renderGroupedContentBlock(groupedBlock, index))}
          </div>
        ) : contentBlocks && contentBlocks.length > 0 ? (
          /* Fallback to individual content blocks */
          <div className="space-y-2">
            {contentBlocks.map((block, index) => renderContentBlock(block, index))}
          </div>
        ) : (
          <>
            {/* Fallback to legacy rendering for backward compatibility */}
            {thinking && showThinking && (
              <Thinking
                thinking={thinking}
                isStreaming={isStreaming}
                defaultExpanded={thinking.length <= 100}
              />
            )}
            
            {/* Main Response */}
            {message ? (
              <div className="rounded-2xl rounded-tl-md px-4 py-3 shadow-sm bg-gray-100 dark:bg-gray-800">
                <div className="text-sm leading-relaxed text-gray-800 dark:text-gray-200 prose prose-sm prose-gray dark:prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {message}
                  </ReactMarkdown>
                </div>
              </div>
            ) : !thinking && (
              <div className="flex items-center justify-start py-2">
                <div className="relative w-5 h-5 flex items-center justify-center">
                  {/* Central dot with dub animation */}
                  <motion.div 
                    className="w-5 h-5 bg-black dark:bg-white rounded-full z-10"
                    animate={{ 
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      duration: 1.0,
                      repeat: Infinity,
                      ease: "easeInOut",
                      times: [0, 0.2, 0.4]
                    }}
                  />
                  {/* Pulsing ripples */}
                  <div className="absolute inset-0 rounded-full bg-black/30 dark:bg-white/30 animate-ping"></div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer: timestamp (left) and optional disclaimer (right) */}
        {!isStreaming && (timestamp || showDisclaimer) && (
          <div className="mt-2 flex items-end justify-between gap-4">
            {timestamp && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            {showDisclaimer && (
              <p className="ml-auto text-right text-xs text-gray-500 dark:text-gray-400">
                This chatbot is an AI-powered assistant and may occasionally produce incorrect or nonsensical answers. Please verify any critical information.
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};