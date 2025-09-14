// src/components/ui/thinking.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface ThinkingBlock {
  id: string;
  content: string;
  timestamp?: Date;
}

interface GroupedContentBlock {
  id: string;
  type: 'thinking' | 'text';
  content: string | ThinkingBlock[];
  timestamp: Date;
  isGrouped?: boolean;
}

interface ThinkingProps {
  thinking?: string | ThinkingBlock[];
  groupedContentBlocks?: GroupedContentBlock[]; // New prop for grouped blocks
  isStreaming?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

export const Thinking: React.FC<ThinkingProps> = ({ 
  thinking, 
  groupedContentBlocks,
  isStreaming = false,
  defaultExpanded = true,
  className = ""
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [hasMultipleBlocks, setHasMultipleBlocks] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Parse thinking content into blocks - prioritize grouped blocks if available
  const thinkingBlocks: ThinkingBlock[] = React.useMemo(() => {
    // If we have grouped content blocks, extract thinking blocks from them
    if (groupedContentBlocks && groupedContentBlocks.length > 0) {
      const allThinkingBlocks: ThinkingBlock[] = [];
      
      groupedContentBlocks.forEach(groupedBlock => {
        if (groupedBlock.type === 'thinking') {
          if (Array.isArray(groupedBlock.content)) {
            // This is a grouped thinking block with multiple individual blocks
            allThinkingBlocks.push(...groupedBlock.content);
          } else if (typeof groupedBlock.content === 'string') {
            // This is a single thinking block
            allThinkingBlocks.push({
              id: groupedBlock.id,
              content: groupedBlock.content,
              timestamp: groupedBlock.timestamp
            });
          }
        }
      });
      
      return allThinkingBlocks;
    }
    
    // Fallback to legacy thinking prop
    if (Array.isArray(thinking)) {
      return thinking;
    }
    
    if (typeof thinking === 'string' && thinking.trim()) {
      return [{
        id: 'thinking-single',
        content: thinking,
        timestamp: new Date()
      }];
    }
    
    return [];
  }, [thinking, groupedContentBlocks]);

  const markdownComponents: Components = {
    // Customize styling for thinking content
    p: ({ children }) => (
      <p className="mb-2 last:mb-0 text-gray-500 dark:text-gray-300">{children}</p>
    ),
    code: ({ children, className, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      const isInline = !match;
      
      if (isInline) {
        return (
          <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-xs font-mono" {...props}>
            {children}
          </code>
        );
      }
      
      return (
        <pre className="bg-gray-800 text-gray-100 p-2 rounded text-xs overflow-x-auto">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      );
    },
    h1: ({ children }) => (
      <h1 className="text-base font-semibold mb-2 mt-3 first:mt-0 text-gray-500 dark:text-gray-200">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-sm font-semibold mb-1 mt-2 first:mt-0 text-gray-500 dark:text-gray-200">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-sm font-medium mb-1 mt-2 first:mt-0 text-gray-500 dark:text-gray-200">{children}</h3>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-outside pl-6 my-2 space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-outside pl-6 my-2 space-y-1">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="ml-0 text-gray-500 dark:text-gray-300">{children}</li>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-gray-400 dark:border-gray-500 pl-2 italic my-1 text-gray-600 dark:text-gray-400">
        {children}
      </blockquote>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-gray-800 dark:text-gray-200">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-gray-700 dark:text-gray-300">{children}</em>
    ),
    a: ({ children, href }) => (
      <a 
        href={href} 
        className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-2">
        <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600 text-xs">
          {children}
        </table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 px-2 py-1 text-left font-medium text-xs">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs">
        {children}
      </td>
    ),
  };

  const totalBlocks = thinkingBlocks.length;
  
  // Track if we've ever had multiple blocks or started streaming
  React.useEffect(() => {
    if (totalBlocks > 1 || isStreaming) {
      setHasMultipleBlocks(true);
    }
  }, [totalBlocks, isStreaming]);
  
  // Show bullet points if there are multiple blocks OR if currently streaming OR if we've had multiple blocks before
  const shouldShowBulletPoints = totalBlocks > 1 || isStreaming || hasMultipleBlocks;

  // Auto-collapse when streaming ends
  React.useEffect(() => {
    if (!isStreaming) setIsExpanded(false);
  }, [isStreaming]);

  // Group consecutive thinking blocks from the same group for visual separation
  const groupedThinkingBlocks = React.useMemo(() => {
    if (!groupedContentBlocks) return [{ blocks: thinkingBlocks, isGrouped: false }];
    
    const groups: Array<{ blocks: ThinkingBlock[], isGrouped: boolean }> = [];
    
    groupedContentBlocks.forEach(groupedBlock => {
      if (groupedBlock.type === 'thinking') {
        if (Array.isArray(groupedBlock.content)) {
          // This is a grouped thinking block with multiple individual blocks
          groups.push({
            blocks: groupedBlock.content,
            isGrouped: true
          });
        } else if (typeof groupedBlock.content === 'string') {
          // This is a single thinking block
          groups.push({
            blocks: [{
              id: groupedBlock.id,
              content: groupedBlock.content,
              timestamp: groupedBlock.timestamp
            }],
            isGrouped: false
          });
        }
      }
    });
    
    return groups.length > 0 ? groups : [{ blocks: thinkingBlocks, isGrouped: false }];
  }, [groupedContentBlocks, thinkingBlocks]);
  
  return (
    <div className={className}>
      <style jsx>{`
        @keyframes gradient-wave {
          0% {
            background-position: -200% center;
          }
          100% {
            background-position: 200% center;
          }
        }
        
        .gradient-wave-text {
          background: linear-gradient(
            90deg,
            #6b7280 0%,
            #6b7280 25%,
            #374151 50%,
            #1f2937 75%,
            #6b7280 100%
          );
          background-size: 200% 100%;
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          animation: gradient-wave 3s ease-in-out infinite;
        }
        
        .gradient-wave-text-dark {
          background: linear-gradient(
            90deg,
            #9ca3af 0%,
            #9ca3af 25%,
            #d1d5db 50%,
            #f3f4f6 75%,
            #9ca3af 100%
          );
          background-size: 200% 100%;
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
          animation: gradient-wave 3s ease-in-out infinite;
        }
        
        .gradient-wave-text-static {
          background: linear-gradient(
            90deg,
            #6b7280 0%,
            #374151 50%,
            #6b7280 100%
          );
          background-size: 100% 100%;
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
        }
        
        .gradient-wave-text-static-dark {
          background: linear-gradient(
            90deg,
            #9ca3af 0%,
            #d1d5db 50%,
            #9ca3af 100%
          );
          background-size: 100% 100%;
          background-clip: text;
          -webkit-background-clip: text;
          color: transparent;
        }
      `}</style>
      
      {/* Header */}
      <div 
        onClick={toggleExpanded}
        className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md p-1 mb-2 transition-colors"
      >
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-gray-600 dark:text-gray-400"
        >
          <ChevronDown size={16} />
        </motion.div>
        
        <div className="text-md font-medium">
          <div className="flex items-center space-x-1">
            <span className={`${isStreaming 
              ? 'gradient-wave-text dark:gradient-wave-text-dark' 
              : 'gradient-wave-text-solid dark:gradient-wave-text-solid-dark'
            }`}>
              Thinking
            </span>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden mt-2"
          >
            <div>
              {/* Render as bullet points if multiple blocks OR streaming */}
              {shouldShowBulletPoints ? (
                <div className="pl-5 py-3 relative">
                  {groupedThinkingBlocks.map((group, groupIndex) => (
                    <div key={`group-${groupIndex}`} className={groupIndex > 0 ? "mt-4" : ""}>
                      <ul className="space-y-3 relative z-10">
                        {group.blocks.map((block, blockIndex) => {
                          const globalIndex = groupedThinkingBlocks
                            .slice(0, groupIndex)
                            .reduce((acc, g) => acc + g.blocks.length, 0) + blockIndex;
                          const totalBlockCount = groupedThinkingBlocks
                            .reduce((acc, g) => acc + g.blocks.length, 0);
                          
                          return (
                            <li key={block.id} className="flex items-start space-x-3 relative">
                              {/* Individual connecting line to next dot - animated */}
                              {globalIndex < totalBlockCount - 1 && (
                                <motion.div 
                                  className="absolute rounded-full left-[2] top-6 bottom-[-12px] w-[1] bg-gray-300 dark:bg-gray-600 z-10"
                                  initial={{ scaleY: 0, opacity: 0 }}
                                  animate={{ scaleY: 1, opacity: 1 }}
                                  transition={{ 
                                    duration: 0.5, 
                                    delay: 0.2,
                                    ease: "easeOut"
                                  }}
                                  style={{ transformOrigin: "top" }}
                                />
                              )}
                              
                              <motion.div 
                                className="flex-shrink-0 w-1.5 h-1.5 bg-gray-700 dark:bg-gray-500 rounded-full mt-2 relative z-20"
                                animate={isStreaming && globalIndex === totalBlockCount - 1 ? {
                                  scale: [1, 1.3, 1],
                                  opacity: [0.7, 1, 0.7]
                                } : {}}
                                transition={isStreaming && globalIndex === totalBlockCount - 1 ? {
                                  duration: 1.5,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                } : {}}
                              />
                              <div className="flex-1 text-sm leading-snug text-gray-200 dark:text-gray-300 prose prose-sm prose-gray dark:prose-invert max-w-none">
                                <motion.div
                                  animate={isStreaming && globalIndex === totalBlockCount - 1 ? {
                                    color: ['#374151', '#1f2937', '#6b7280', '#374151']
                                  } : {}}
                                  transition={isStreaming && globalIndex === totalBlockCount - 1 ? {
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                  } : {}}
                                >
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={markdownComponents}
                                  >
                                    {block.content}
                                  </ReactMarkdown>
                                </motion.div>
                                {/* Show streaming indicator on the last block if streaming */}
                                {isStreaming && globalIndex === totalBlockCount - 1 && (
                                  <motion.span
                                    animate={{ opacity: [0, 1, 0] }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                    className="inline-block w-2 h-0.5 bg-gray-400 ml-1"
                                  />
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      {/* Visual separator between groups if multiple groups */}
                      {group.isGrouped && groupIndex < groupedThinkingBlocks.length - 1 && (
                        <div className="ml-2 mt-3 mb-1 h-px bg-gradient-to-r from-gray-300 to-transparent dark:from-gray-600 opacity-50" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pl-5 py-3">
                  <div className="text-sm leading-snug text-gray-700 dark:text-gray-300 prose prose-sm prose-gray dark:prose-invert max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {thinkingBlocks[0]?.content || ''}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};