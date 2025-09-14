// src/components/ChatBot.tsx
"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import CustomTextbox from './ui/custom-textbox';
import { ToggleOption } from './ui/custom-toggle-group';
import ChatTitle from './ui/chat-title';
import { SendIcon } from './ui/send-icon';
import { UserMessage } from './ui/user-message';
import { BotMessage } from './ui/bot-message';
import { streamChatSSE, executeQuerySSE, ExecuteQueryRequest } from '../lib/api';
import { Message, MessageContainer, InterruptedQuery } from './message-container';
import { ContentBlock, GroupedContentBlock, SqlExecution, ThinkingBlock } from '../lib/content-parser';
import { Database, AlertCircle, Eye, Zap, Users } from 'lucide-react';

interface ChatBotProps {
  className?: string;
  title?: string;
  subtitle?: string;
  titleSize?: 'sm' | 'md' | 'lg';
  onSqlPanelToggle?: (isOpen: boolean) => void;
  isSqlPanelOpen?: boolean;
  sqlExecutions?: SqlExecution[];
  setSqlExecutions?: React.Dispatch<React.SetStateAction<SqlExecution[]>>;
  // New props for SQL panel query editing
  onSqlQueryEdit?: (queryId: string, newQuery: string, newPurpose: string) => void;
  onSqlQueryResume?: (queryId: string) => Promise<void>;
  onExposeHandlers?: (handlers: { edit: (id: string, query: string, purpose: string) => void, resume: (id: string) => Promise<void> }) => void;
}

export const ChatBot: React.FC<ChatBotProps> = ({ 
  className,
  title = "How can I help you today?",
  subtitle = "Ask me anything or start a conversation",
  titleSize = 'lg',
  onSqlPanelToggle,
  isSqlPanelOpen = false,
  sqlExecutions = [],
  setSqlExecutions,
  onSqlQueryEdit,
  onSqlQueryResume,
  onExposeHandlers
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [sqlBadgeCount, setSqlBadgeCount] = useState(0);
  const [selectedMode, setSelectedMode] = useState('autonomous');
  const [hasInterruptedMessage, setHasInterruptedMessage] = useState(false); // Global interrupt flag
  const [isSqlTooltipVisible, setIsSqlTooltipVisible] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevSqlCountRef = useRef(0);
  const threadIdRef = useRef<string>(crypto.randomUUID());

  const toggleOptions: ToggleOption[] = [
    {
      id: 'review',
      label: 'Review',
      tooltip: 'Approve final actions before execution',
      badge: 'Balanced',
      description: 'Review and edit the final SQL query; add guidance before execution.',
      icon: <Eye className="w-4 h-4" />,
    },
    {
      id: 'autonomous',
      label: 'Autonomous',
      tooltip: 'AI works independently without interruption',
      badge: 'Fastest',
      description: 'Agent works independently without interruption.',
      icon: <Zap className="w-4 h-4" />,
    },
    {
      id: 'collaborative',
      label: 'Collaborative',
      tooltip: 'Guide every step of the process',
      badge: 'Most Control',
      description: 'Review, edit, and provide guidance at every step (intermediate and final).',
      icon: <Users className="w-4 h-4" />,
    }
  ];

  // Map toggle selection to interrupt policy
  const getInterruptPolicy = (mode: string): string => {
    switch (mode) {
      case 'autonomous':
        return 'never';
      case 'review':
        return 'final';
      case 'collaborative':
        return 'always';
      default:
        return 'never';
    }
  };
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle SQL panel auto-opening when new executions arrive
  useEffect(() => {
    if (sqlExecutions.length > prevSqlCountRef.current && sqlExecutions.length > 0) {
      if (onSqlPanelToggle && !isSqlPanelOpen) {
        onSqlPanelToggle(true);
        setSqlBadgeCount(0);
      }
    }
    prevSqlCountRef.current = sqlExecutions.length;
  }, [sqlExecutions.length, onSqlPanelToggle, isSqlPanelOpen]);

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(event.target.value);
  };

  const handleModeChange = (mode: string) => {
    setSelectedMode(mode);
  };

  const addMessage = (
    content: string, 
    type: 'user' | 'bot', 
    thinking?: ThinkingBlock[],
    isInterrupted?: boolean,
    interruptedQuery?: InterruptedQuery,
    threadId?: string,
    contentBlocks?: ContentBlock[],
    groupedContentBlocks?: GroupedContentBlock[]
    ): string => {
      const newMessage: Message = {
        id: crypto.randomUUID(),
        content,
        thinking,
        contentBlocks,
        groupedContentBlocks,
        type,
        timestamp: new Date(),
        isInterrupted: isInterrupted || false,
        interruptedQuery,
        canEditQuery: isInterrupted && !!interruptedQuery,
        threadId
      };
      setMessages(prev => [...prev, newMessage]);
      
      // Update global interrupt flag
      if (isInterrupted) {
        setHasInterruptedMessage(true);
      }
      
      return newMessage.id;
    };

  const updateStreamingMessage = (
      messageId: string, 
      content: string, 
      thinking?: ThinkingBlock[],
      isInterrupted?: boolean,
      interruptedQuery?: InterruptedQuery,
      threadId?: string,
      contentBlocks?: ContentBlock[],
      groupedContentBlocks?: GroupedContentBlock[]
    ) => {
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { 
              ...msg, 
              content, 
              thinking,
              contentBlocks,
              groupedContentBlocks,
              isInterrupted: isInterrupted || msg.isInterrupted,
              interruptedQuery: interruptedQuery || msg.interruptedQuery,
              canEditQuery: (isInterrupted || msg.isInterrupted) && !!(interruptedQuery || msg.interruptedQuery),
              threadId: threadId || msg.threadId
            }
          : msg
      ));
      
      // Update global interrupt flag
      if (isInterrupted) {
        setHasInterruptedMessage(true);
      }
    };

  const mergeSqlExecutions = (
    existing: SqlExecution[], 
    incoming: SqlExecution[], 
    fallbackThreadId?: string
  ): SqlExecution[] => {
    const merged = [...existing];
    
    incoming.forEach(newSql => {
      const existingIndex = merged.findIndex(sql => sql.id === newSql.id);
      if (existingIndex >= 0) {
        const existingSql = merged[existingIndex];
        
        // Update existing execution, preserving important fields
        merged[existingIndex] = {
          ...merged[existingIndex],
          ...newSql,
          // Preserve original query if the new one is empty (resume scenario)
          query: newSql.query.trim() === '' ? existingSql.query : newSql.query,
          // Preserve original purpose if the new one is generic
          purpose: (newSql.purpose === 'Query execution' && existingSql.purpose && existingSql.purpose !== 'Query execution') 
            ? existingSql.purpose 
            : newSql.purpose,
          // Preserve original threadId if it exists
          threadId: existingSql.threadId || newSql.threadId || fallbackThreadId,
          // Preserve original purpose for comparison if needed
          originalPurpose: existingSql.originalPurpose || existingSql.purpose
        };
      } else {
        // Add new execution only if ID doesn't exist
        merged.push({
          ...newSql,
          threadId: newSql.threadId || fallbackThreadId,
          originalPurpose: newSql.purpose
        });
      }
    });
    
    return merged;
  };

  const handleStreamResponse = async (userMessage: string) => {
    const botMessageId = addMessage('', 'bot', undefined, undefined, undefined, threadIdRef.current);
    setStreamingMessageId(botMessageId);
    
    // Get the current interrupt policy based on selected mode
    const currentInterruptPolicy = getInterruptPolicy(selectedMode);
    
    try {
      await streamChatSSE(
        { 
          message: userMessage,
          userId: '5d1c81f9-abc4-44e9-a651-471fd36c56d2',
          threadId: threadIdRef.current,
          interrupt_policy: currentInterruptPolicy,
          chatModelSettings: {
            primary_model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
            secondary_model: "us.anthropic.claude-opus-4-20250514-v1:0",
            max_tokens: 16384
          }
        },

        (text: string, thinking?: ThinkingBlock[], sqlExecutions?: SqlExecution[], hasNewSql?: boolean, isInterrupted?: boolean, interruptedQuery?: InterruptedQuery | null, contentBlocks?: ContentBlock[], groupedContentBlocks?: GroupedContentBlock[]) => {
          updateStreamingMessage(
            botMessageId, 
            text, 
            thinking, 
            isInterrupted, 
            interruptedQuery || undefined, 
            threadIdRef.current,
            contentBlocks,
            groupedContentBlocks // Pass grouped blocks
          );
          
          // Handle SQL executions with deduplication
          if (sqlExecutions && sqlExecutions.length > 0 && setSqlExecutions) {
            setSqlExecutions(prev => mergeSqlExecutions(prev, sqlExecutions, threadIdRef.current));
          }
        },
        // onError
        (error: string) => {
          updateStreamingMessage(botMessageId, 'Sorry, I encountered an error. Please try again.');
          setStreamingMessageId(null);
        },
        // onComplete
        () => {
          setStreamingMessageId(null);
          // Update the timestamp when streaming is complete
          setMessages(prev => prev.map(msg => 
            msg.id === botMessageId 
              ? { ...msg, timestamp: new Date() }
              : msg
          ));
        }
      );
    } catch (error) {
      console.error('Failed to start stream:', error);
      updateStreamingMessage(botMessageId, 'Sorry, I encountered an error. Please try again.');
      setStreamingMessageId(null);
    }
  };

  const handleSend = async () => {
    if (inputText.trim() && !isLoading) {
      setIsLoading(true);
      
      const userMessage = inputText.trim();
      setInputText('');
      
      // Add user message
      addMessage(userMessage, 'user');
      
      try {
        await handleStreamResponse(userMessage);
      } catch (error) {
        console.error('Error sending message:', error);
        addMessage('Sorry, I encountered an error. Please try again.', 'bot');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleSqlPanelToggle = () => {
    const newState = !isSqlPanelOpen;
    onSqlPanelToggle?.(newState);
    if (newState) {
      setSqlBadgeCount(0); // Clear badge when opening panel
    }
  };

  // Use refs to avoid stale closures and infinite loops
  const sqlExecutionsRef = useRef<SqlExecution[]>(sqlExecutions);
  const setIsLoadingRef = useRef(setIsLoading);
  const setStreamingMessageIdRef = useRef(setStreamingMessageId);
  const setMessagesRef = useRef(setMessages);
  const setSqlExecutionsRef = useRef(setSqlExecutions);

  // Update refs on every render
  useEffect(() => {
    sqlExecutionsRef.current = sqlExecutions;
    setIsLoadingRef.current = setIsLoading;
    setStreamingMessageIdRef.current = setStreamingMessageId;
    setMessagesRef.current = setMessages;
    setSqlExecutionsRef.current = setSqlExecutions;
  });

  // Function to handle query editing from SQL panel - using useCallback with stable deps
  const handleSqlQueryEdit = useCallback((queryId: string, newQuery: string, newPurpose: string) => {
    const setSqlExecutions = setSqlExecutionsRef.current;
    if (!setSqlExecutions) return;
    
    setSqlExecutions(prev => prev.map(sql => 
      sql.id === queryId 
        ? { 
            ...sql, 
            query: newQuery,
            purpose: newPurpose,
            // Keep original purpose for comparison if needed
            originalPurpose: sql.originalPurpose || sql.purpose
          }
        : sql
    ));
  }, []); // Empty dependency array since we use refs

  // Function to resume query execution from SQL panel - using useCallback with stable deps
  const handleSqlQueryResume = useCallback(async (queryId: string) => {
    const setSqlExecutions = setSqlExecutionsRef.current;
    const setIsLoading = setIsLoadingRef.current;
    const setStreamingMessageId = setStreamingMessageIdRef.current;
    const setMessages = setMessagesRef.current;
    const currentSqlExecutions = sqlExecutionsRef.current;
    
    if (!setSqlExecutions) return;
    
    // Find the query (look for interrupted OR executing status to be more flexible)
    const targetSql = currentSqlExecutions.find(sql => 
      sql.id === queryId && (sql.status === 'interrupted' || sql.status === 'executing')
    );
    
    if (!targetSql) {
      console.error('Cannot resume: query not found', { 
        queryId, 
        availableIds: currentSqlExecutions.map(s => ({ id: s.id, status: s.status })) 
      });
      return;
    }

    // If it's already executing, don't start again
    if (targetSql.status === 'executing') {
      return;
    }

    // Ensure we have a threadId
    let threadId = targetSql.threadId;
    if (!threadId) {
      threadId = crypto.randomUUID();
      // Update the SQL execution with the new threadId
      setSqlExecutions(prev => prev.map(sql => 
        sql.id === queryId 
          ? { ...sql, threadId }
          : sql
      ));
    }

    setIsLoading(true);
    
    // Clear interrupt state from any message with matching threadId
    setMessages(prev => {
      const updated = prev.map(msg => 
        msg.threadId === threadId && msg.isInterrupted
          ? { 
              ...msg, 
              isInterrupted: false,
              canEditQuery: false
            }
          : msg
      );
      
      // Check if there are any remaining interrupted messages
      const stillHasInterrupts = updated.some(msg => msg.isInterrupted);
      if (!stillHasInterrupts) {
        setHasInterruptedMessage(false);
      }
      
      return updated;
    });
    
    // Update status to executing - single state update
    setSqlExecutions(prev => prev.map(sql => 
      sql.id === queryId 
        ? { ...sql, status: 'executing', error: undefined }
        : sql
    ));
    
    // Create a new bot message for the query execution response
    const botMessageId = addMessage('', 'bot', undefined, undefined, undefined, threadId);
    setStreamingMessageId(botMessageId);
    
    try {
      const queryRequest: ExecuteQueryRequest = {
        query: targetSql.query,
        reason: targetSql.purpose || 'User requested query execution after interrupt',
        chat_model_settings: {
          primary_model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
          secondary_model: "us.anthropic.claude-opus-4-20250514-v1:0",
          max_tokens: 16384
        }
      };

      // executeQuerySSE callback now receives contentBlocks
    await executeQuerySSE(
      queryRequest,
      '5d1c81f9-abc4-44e9-a651-471fd36c56d2',
      threadId,
      queryId,

      (text: string, thinking?: ThinkingBlock[], newSqlExecutions?: SqlExecution[], hasNewSql?: boolean, isInterrupted?: boolean, interruptedQuery?: InterruptedQuery | null, contentBlocks?: ContentBlock[]) => {
        
        updateStreamingMessage(
          botMessageId, 
          text, 
          thinking, 
          isInterrupted, 
          interruptedQuery || undefined, 
          threadId,
          contentBlocks
        );
        
        // Handle SQL executions with proper merging and deduplication
        if (newSqlExecutions && newSqlExecutions.length > 0) {
          const currentSetSqlExecutions = setSqlExecutionsRef.current;
          if (currentSetSqlExecutions) {
            currentSetSqlExecutions(prev => {
              const merged = mergeSqlExecutions(prev, newSqlExecutions, threadId);
              return merged;
            });
          }
        }
      },
      
      // onError
      (error: string) => {
        console.error('Query execution error:', error);
      },
      
      () => {
        setStreamingMessageId(null);
        setMessages(prev => prev.map(msg => 
          msg.id === botMessageId 
            ? { ...msg, timestamp: new Date() }
            : msg
        ));
      }
    );
    } catch (error) {
      console.error('Error executing query from SQL panel:', error);
      updateStreamingMessage(botMessageId, 'Sorry, I encountered an error executing the query. Please try again.');
      setStreamingMessageId(null);
      
      // Update status back to interrupted on error
      setSqlExecutions(prev => prev.map(sql => 
        sql.id === queryId 
          ? { ...sql, status: 'interrupted', error: 'Failed to execute query' }
          : sql
      ));
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty dependency array since we use refs

  // Use provided SQL query editing functions or internal implementations
  const handleSqlQueryEditInternal = onSqlQueryEdit || handleSqlQueryEdit;
  const handleSqlQueryResumeInternal = onSqlQueryResume || handleSqlQueryResume;

  // Expose handlers to parent - only run when onExposeHandlers changes
  useEffect(() => {
    if (onExposeHandlers) {
      onExposeHandlers({
        edit: handleSqlQueryEditInternal,
        resume: handleSqlQueryResumeInternal
      });
    }
  }, [onExposeHandlers]); // Only depend on onExposeHandlers

  const isSendDisabled = !inputText.trim() || isLoading;
  const hasMessages = messages.length > 0;
  // Identify the latest bot message to show the disclaimer on it
  const lastBotMessageId = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].type === 'bot') return messages[i].id;
    }
    return null;
  }, [messages]);

  const containerClassName = `
    flex
    flex-col
    w-full
    h-full
    relative
    ${className || ''}
  `.replace(/\s+/g, ' ').trim();

  return (
    <motion.div 
      className={containerClassName}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {!hasMessages && (
        <div className="flex-shrink-0">
          <ChatTitle
            title={title}
            subtitle={subtitle}
            size={titleSize}
            animationDelay={0.1}
          />
        </div>
      )}
      
      {/* Messages Container */}
      {hasMessages && (
        <MessageContainer className="flex-1 overflow-y-auto min-h-0">
          {messages.map((message) => (
            message.type === 'user' ? (
              <UserMessage 
                key={message.id}
                message={message.content}
                timestamp={message.timestamp}
              />
            ) : (
              <BotMessage 
                key={message.id}
                message={message.content}
                thinking={message.thinking}
                contentBlocks={message.contentBlocks}
                groupedContentBlocks={message.groupedContentBlocks}
                timestamp={message.timestamp}
                isStreaming={streamingMessageId === message.id}
                showThinking={true}
                showDisclaimer={lastBotMessageId === message.id && streamingMessageId !== message.id && !message.isInterrupted}
                isInterrupted={message.isInterrupted}
                interruptedQuery={message.interruptedQuery}
                canEditQuery={message.canEditQuery}
              />
            )
          ))}
          {/* Auto-scroll target */}
          <div ref={messagesEndRef} />
        </MessageContainer>
      )}
      
      {/* Input Area */}
      <div className="flex-shrink-0 p-4">
        <CustomTextbox 
          value={inputText}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={hasMessages ? 'Ask anything' : 'Ask anything'}
          disabled={isLoading}
          toggleOptions={toggleOptions}
          toggleValue={selectedMode}
          onToggleChange={handleModeChange}
        >
          <SendIcon
            isLoading={isLoading} 
            disabled={isSendDisabled}
            size="md"
            onClick={handleSend}
          />
        </CustomTextbox>
      </div>

      {/* Interrupt Indicator */}
      {hasInterruptedMessage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-20 right-6 bg-black hover:bg-black text-white px-5 py-2.5 rounded-lg shadow-lg ring-1 ring-white/20 z-30 flex items-center space-x-3"
        >
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">Query interrupted - you can edit and resume</span>
        </motion.div>
      )}

      {/* SQL Panel Toggle Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, type: 'spring' }}
        onClick={handleSqlPanelToggle}
        onMouseEnter={() => setIsSqlTooltipVisible(true)}
        onMouseLeave={() => setIsSqlTooltipVisible(false)}
        className={`fixed bottom-6 right-6 bg-black hover:bg-black text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-30 group cursor-pointer ${
          isSqlPanelOpen ? 'bg-black' : ''
        }`}
      >
        <Database className="w-6 h-6" />
        {sqlBadgeCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {sqlBadgeCount}
          </span>
        )}
        {isSqlTooltipVisible && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.95 }}
            className={`absolute right-full top-1/2 transform -translate-y-1/2 mr-2 bg-gray-900 text-white rounded-md shadow-lg whitespace-nowrap z-50 text-sm px-3 py-1.5`}
          >
            Toggle SQL Panel
            <div className="absolute left-full top-1/2 transform -translate-y-1/2">
              <div className="border-4 border-transparent border-l-gray-900"></div>
            </div>
          </motion.div>
        )}
      </motion.button>
    </motion.div>
  );
};

// Export the internal functions for use by parent components
export { ChatBot as default };
export type { ChatBotProps };