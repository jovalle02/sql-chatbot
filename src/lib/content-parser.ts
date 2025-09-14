/* eslint-disable prefer-const */

type SqlResult = Record<string, unknown> | Record<string, unknown>[] | string | number | boolean | null;

export interface SqlExecution {
  id: string;
  purpose?: string;
  query: string;
  results?: SqlResult;
  timestamp: Date;
  status?: 'executing' | 'completed' | 'error' | 'interrupted';
  error?: string;
  threadId?: string; // Add threadId for interrupted queries to resume later
  originalPurpose?: string; // Keep original purpose for comparison
}

//New blocks that are individual, so we do not group in one for thinking and one for text.
export interface ContentBlock {
  id: string;
  type: 'thinking' | 'text';
  content: string;
  timestamp: Date;
}

export interface GroupedContentBlock {
  id: string;
  type: 'thinking' | 'text';
  content: string | ThinkingBlock[]; // Can be string for text or array for grouped thinking
  timestamp: Date;
  isGrouped?: boolean; // Flag to indicate this contains multiple blocks
}

export interface ThinkingBlock {
  id: string;
  content: string;
  timestamp: Date;
}

export interface InterruptedQuery {
  id: string;
  query: string;
  purpose?: string;
  originalQuery: string;
}

export class ContentParser {
  // Replace separate arrays with unified content blocks
  private contentBlocks: ContentBlock[] = [];
  private currentBlock: ContentBlock | null = null;
  private blockCounter: number = 0;

  // Keep these for backward compatibility and legacy logic
  private thinkingBlocks: ThinkingBlock[] = [];
  private textContent: string = '';
  private currentThinkingContent: string = '';
  
  // Current block type tracking
  private currentBlockType: 'thinking' | 'text' | 'tool-input' | 'tool-output' | null = null;
  
  // Tool processing
  private currentToolInput: string = '';
  private currentToolOutput: string = '';
  private sqlExecutions: SqlExecution[] = [];
  private currentSqlId: string | null = null;
  private justEndedBlock: boolean = false;
  private isStreamingThinking: boolean = false;
  
  // Interrupt handling
  private isInterrupted: boolean = false;
  private interruptedQuery: InterruptedQuery | null = null;

  private resumeTargetSqlId: string | null = null;

  setResumeTargetSqlId(sqlId: string) {
    this.resumeTargetSqlId = sqlId;
  }

  reset() {
    // Reset new content blocks
    this.contentBlocks = [];
    this.currentBlock = null;
    this.blockCounter = 0;
    
    // Reset legacy fields
    this.thinkingBlocks = [];
    this.currentThinkingContent = '';
    this.textContent = '';
    this.currentBlockType = null;
    this.currentToolInput = '';
    this.currentToolOutput = '';
    this.sqlExecutions = [];
    this.currentSqlId = null;
    this.justEndedBlock = false;
    this.isStreamingThinking = false;
    
    // Reset interrupt state
    this.isInterrupted = false;
    this.interruptedQuery = null;
  }

  // Helper method to create individual content blocks
  private createNewContentBlock(type: 'thinking' | 'text'): ContentBlock {
    this.blockCounter++;
    const newBlock: ContentBlock = {
      id: `${type}-${this.blockCounter}`,
      type,
      content: '',
      timestamp: new Date()
    };
    this.contentBlocks.push(newBlock);
    this.currentBlock = newBlock;
    return newBlock;
  }

  // New method to group consecutive blocks of the same type
  private groupConsecutiveBlocks(blocks: ContentBlock[]): GroupedContentBlock[] {
    if (blocks.length === 0) return [];
    
    const grouped: GroupedContentBlock[] = [];
    let currentGroup: {
      type: 'thinking' | 'text';
      blocks: ContentBlock[];
      startTimestamp: Date;
    } | null = null;
    
    const finalizeCurrentGroup = () => {
      if (!currentGroup) return;
      
      if (currentGroup.type === 'thinking') {
        // For thinking blocks, create a grouped block with individual thinking blocks
        const thinkingBlocks: ThinkingBlock[] = currentGroup.blocks.map(block => ({
          id: block.id,
          content: block.content,
          timestamp: block.timestamp
        }));
        
        grouped.push({
          id: `grouped-thinking-${grouped.length + 1}`,
          type: 'thinking',
          content: thinkingBlocks,
          timestamp: currentGroup.startTimestamp,
          isGrouped: thinkingBlocks.length > 1
        });
      } else {
        // For text blocks, merge content as before
        const mergedContent = currentGroup.blocks.map(block => block.content).join('');
        grouped.push({
          id: currentGroup.blocks.length > 1 ? `grouped-text-${grouped.length + 1}` : currentGroup.blocks[0].id,
          type: 'text',
          content: mergedContent,
          timestamp: currentGroup.startTimestamp,
          isGrouped: currentGroup.blocks.length > 1
        });
      }
    };
    
    for (const block of blocks) {
      if (!currentGroup || currentGroup.type !== block.type) {
        // Finalize previous group
        finalizeCurrentGroup();
        
        // Start new group
        currentGroup = {
          type: block.type,
          blocks: [block],
          startTimestamp: block.timestamp
        };
      } else {
        // Add to current group
        currentGroup.blocks.push(block);
        // Update timestamp to earliest
        if (block.timestamp < currentGroup.startTimestamp) {
          currentGroup.startTimestamp = block.timestamp;
        }
      }
    }
    
    // Finalize the last group
    finalizeCurrentGroup();
    
    return grouped;
  }

  parseChunk(rawChunk: string): { 
    text: string; 
    thinking: ThinkingBlock[];
    contentBlocks: ContentBlock[]; //Individual blocks (not grouped)
    groupedContentBlocks: GroupedContentBlock[]; //Grouped blocks
    sqlExecutions: SqlExecution[];
    hasNewSql: boolean;
    isInterrupted: boolean;
    interruptedQuery: InterruptedQuery | null;
  } {
    const hadSqlBefore = this.sqlExecutions.length;
    
    // Handle the outer JSON wrapper format: data: {"content": "..."}
    const lines = rawChunk.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
      
      // Check for interrupt event
      if (trimmedLine.includes('event: __interrupt__')) {
        this.handleInterrupt(lines);
        break; // Stop processing after interrupt
      }
      
      // Parse the outer JSON wrapper
      if (trimmedLine.startsWith('data: {')) {
        try {
          const jsonStr = trimmedLine.substring(6); // Remove 'data: '
          const parsed = JSON.parse(jsonStr);
          
          if (parsed.content) {
            this.processSSEContent(parsed.content);
          }
        } catch (_error) {
          console.warn('Failed to parse JSON line:', trimmedLine);
        }
      }
    }
    
    const hasNewSql = this.sqlExecutions.length > hadSqlBefore;
    
    // Convert contentBlocks back to legacy format for backward compatibility
    this.updateLegacyFormat();
    
    // Group consecutive blocks of the same type
    const groupedContentBlocks = this.groupConsecutiveBlocks(this.contentBlocks);
    
    return {
      text: this.textContent,
      thinking: [...this.thinkingBlocks],
      contentBlocks: [...this.contentBlocks], // Return original individual blocks
      groupedContentBlocks, // Return grouped blocks separately
      sqlExecutions: [...this.sqlExecutions],
      hasNewSql,
      isInterrupted: this.isInterrupted,
      interruptedQuery: this.interruptedQuery
    };
  }

  // Convert contentBlocks back to legacy format for backward compatibility
  private updateLegacyFormat() {
    // Group consecutive blocks first for legacy format too
    const groupedBlocks = this.groupConsecutiveBlocks(this.contentBlocks);
    
    // Update thinkingBlocks from grouped contentBlocks
    this.thinkingBlocks = [];
    groupedBlocks
      .filter(block => block.type === 'thinking')
      .forEach(block => {
        if (Array.isArray(block.content)) {
          // If content is an array of ThinkingBlock[], add all blocks
          this.thinkingBlocks.push(...block.content);
        } else if (typeof block.content === 'string') {
          // If content is a string, create a ThinkingBlock
          this.thinkingBlocks.push({
            id: block.id,
            content: block.content,
            timestamp: block.timestamp
          });
        }
      });
    
    // Update textContent from grouped contentBlocks
    this.textContent = groupedBlocks
      .filter(block => block.type === 'text')
      .map(block => typeof block.content === 'string' ? block.content : '')
      .join('');
  }

  //Complete rewrite of processSSEContent to use individual blocks
  private processSSEContent(sseContent: string) {
    const sseLines = sseContent.split('\n');
    
    for (let i = 0; i < sseLines.length; i++) {
      const line = sseLines[i].trim();
      
      if (!line) continue;
      
      // Handle block transitions
      if (line === 'event: block-start') {
        const nextLine = sseLines[i + 1]?.trim();
        if (nextLine === 'data: "thinking"') {
          this.currentBlockType = 'thinking';
          this.currentThinkingContent = '';
          this.createNewContentBlock('thinking'); // Create new individual thinking block
          this.isStreamingThinking = true;
          i++; // Skip the next line since we processed it
        } else if (nextLine === 'data: "text"') {
          this.currentBlockType = 'text';
          this.createNewContentBlock('text'); // Create new individual text block
          i++; // Skip the next line since we processed it
        } else if (nextLine === 'data: "tool-input"') {
          this.currentBlockType = 'tool-input';
          this.currentToolInput = '';
          this.currentSqlId = `sql-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          i++; // Skip the next line since we processed it
        } else if (nextLine === 'data: "tool-output"') {
          this.currentBlockType = 'tool-output';
          this.currentToolOutput = '';
          i++; // Skip the next line since we processed it
        }
        continue;
      }
      
      if (line === 'event: block-end') {
        // Set flag to ignore the next data line (which contains block type metadata)
        this.justEndedBlock = true;
        
        // Handle end of thinking block - finalize the content
        if (this.currentBlockType === 'thinking' && this.isStreamingThinking) {
          if (this.currentBlock && this.currentBlock.type === 'thinking') {
            this.currentBlock.content = this.currentThinkingContent.trim();
          }
          this.currentThinkingContent = '';
          this.isStreamingThinking = false;
        }
        // Handle end of tool blocks
        else if (this.currentBlockType === 'tool-input' && this.currentSqlId) {
          this.processSqlInput();
        } else if (this.currentBlockType === 'tool-output') {
          // For resume scenarios, use the resume target SQL ID
          if (!this.currentSqlId && this.resumeTargetSqlId) {
            this.currentSqlId = this.resumeTargetSqlId;
          }
          
          if (this.currentSqlId) {
            this.processSqlOutput();
          } else {
            console.warn('ContentParser: No currentSqlId available for tool-output processing');
          }
        }
        
        // Clear the current block references
        this.currentBlock = null;
        this.currentBlockType = null;
        continue;
      }
      
      // Handle event type changes, create new blocks on each event
      if (line === 'event: thinking') {
        if (this.currentBlockType !== 'thinking') {
          this.currentBlockType = 'thinking';
          this.currentThinkingContent = '';
          this.createNewContentBlock('thinking'); // This creates a new individual block
          this.isStreamingThinking = true;
        }
        continue;
      }
      
      if (line === 'event: text') {
        if (this.currentBlockType !== 'text') {
          this.currentBlockType = 'text';
          this.createNewContentBlock('text'); // This creates a new individual block
        }
        continue;
      }
      
      if (line === 'event: tool-input') {
        this.currentBlockType = 'tool-input';
        continue;
      }
      
      if (line === 'event: tool-output') {
        this.currentBlockType = 'tool-output';
        continue;
      }
      
      if (line.startsWith('data: ')) {
        if (this.justEndedBlock) {
          this.justEndedBlock = false;
          continue;
        }
        
        if (!this.currentBlockType) {
          continue;
        }
        
        const dataContent = line.substring(6); // Remove 'data: '
        
        // Handle tool blocks (keep existing logic)
        if (this.currentBlockType === 'tool-input' || this.currentBlockType === 'tool-output') {
          let content: string = "";

          let rawContent = dataContent;
          
          if (this.currentBlockType === 'tool-input') {
            try {
              content = JSON.parse(rawContent);
            } catch (error) {
              console.warn('Failed to parse tool output as JSON:', rawContent, error);
            }
          }
          
          if (this.currentBlockType === 'tool-input') {
            this.currentToolInput += content;
          } else {
            this.currentToolOutput += rawContent;
          }
        } else {
          // Handle content blocks - write to individual blocks
          try {
            const content = JSON.parse(dataContent);
            
            if (this.currentBlockType === 'thinking') {
              this.currentThinkingContent += content;
              
              // Update the current individual thinking block
              if (this.currentBlock && this.currentBlock.type === 'thinking') {
                this.currentBlock.content = this.currentThinkingContent;
              }
            } else if (this.currentBlockType === 'text') {
              // Update the current individual text block
              if (this.currentBlock && this.currentBlock.type === 'text') {
                this.currentBlock.content += content;
              }
            }
          } catch (error) {
            console.warn('Failed to parse text/thinking content:', dataContent, error);
          }
        }
      } else if (this.currentBlockType === 'tool-input' || this.currentBlockType === 'tool-output') {
        // Handle raw content lines that don't start with 'data: ' for tool blocks
        let rawContent = line;
        
        // Remove surrounding quotes if present
        if (rawContent.startsWith('"') && rawContent.endsWith('"')) {
          rawContent = rawContent.slice(1, -1);
        }
      
        if (this.currentBlockType === 'tool-input') {
          this.currentToolInput += rawContent;
        } else {
          this.currentToolOutput += rawContent;
        }
      }
      
      // Handle completion
      if (line.startsWith('event: complete')) {
        // Finalize any remaining thinking block
        if (this.currentBlockType === 'thinking' && this.isStreamingThinking) {
          if (this.currentBlock && this.currentBlock.type === 'thinking') {
            this.currentBlock.content = this.currentThinkingContent.trim();
          }
          this.currentThinkingContent = '';
          this.isStreamingThinking = false;
        }
        this.currentBlock = null;
        this.currentBlockType = null;
        continue;
      }
    }
  }

  // Keep existing methods unchanged
  private handleInterrupt(lines: string[]) {
    this.isInterrupted = true;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('data: [') && line.includes('"value"')) {
        try {
          const dataStr = line.substring(6);
          const interruptData = JSON.parse(dataStr);
          
          if (Array.isArray(interruptData) && interruptData.length > 0) {
            const queryData = interruptData[0];
            
            if (queryData.value && this.isSqlQuery(queryData.value)) {
              this.interruptedQuery = {
                id: queryData.id || `interrupted-${Date.now()}`,
                query: queryData.value,
                originalQuery: queryData.value,
                purpose: 'Interrupted Query'
              };
              
              const interruptedSqlExecution: SqlExecution = {
                id: queryData.id || `interrupted-${Date.now()}`,
                purpose: 'Interrupted Query',
                originalPurpose: 'Interrupted Query',
                query: queryData.value,
                timestamp: new Date(),
                status: 'interrupted'
              };
              
              this.sqlExecutions.push(interruptedSqlExecution);
            }
          }
        } catch (error) {
          console.warn('Failed to parse interrupt data:', error);
        }
        break;
      }
    }
    
    if (!this.interruptedQuery && this.currentToolInput && this.currentSqlId) {
      try {
        const toolInput = JSON.parse(this.currentToolInput);
        if (toolInput.query && this.isSqlQuery(toolInput.query)) {
          this.interruptedQuery = {
            id: this.currentSqlId,
            query: toolInput.query,
            originalQuery: toolInput.query,
            purpose: toolInput.purpose || 'Interrupted Query'
          };
          
          const interruptedSqlExecution: SqlExecution = {
            id: this.currentSqlId,
            purpose: toolInput.purpose || 'Interrupted Query',
            originalPurpose: toolInput.purpose || 'Interrupted Query',
            query: toolInput.query,
            timestamp: new Date(),
            status: 'interrupted'
          };
          
          this.sqlExecutions.push(interruptedSqlExecution);
        }
      } catch (error) {
        console.warn('Failed to parse current tool input for interrupt:', error);
      }
    }
  }

  private processSqlInput() {
    if (!this.currentSqlId || !this.currentToolInput) return;
    
    try {
      const toolInput = JSON.parse(this.currentToolInput);
      
      if (toolInput.query && this.isSqlQuery(toolInput.query)) {
        const sqlExecution: SqlExecution = {
          id: this.currentSqlId,
          purpose: toolInput.purpose || 'Query execution',
          query: toolInput.query,
          timestamp: new Date(),
          status: 'executing'
        };
        
        this.sqlExecutions.push(sqlExecution);
      }
    } catch (error) {
      console.warn('Failed to parse tool input:', error);
    }
  }

  private processSqlOutput() {
  if (!this.currentSqlId || !this.currentToolOutput) return;
  
  try {
    
    const raw = this.currentToolOutput;
    let s = raw.trim().replace(/^"/, "").replace(/"$/, "");

    s = s
      .replace(/\\"/g, '"')
      .replace(/\\\"/g, '\"')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\(?=[A-Za-z_]\w*")/g, '"')
      .replace(/"([^"\\]*?)\\\s*:/g, '"$1":');

    const toolOutput = JSON.parse(s);
    
    const sqlIndex = this.sqlExecutions.findIndex(sql => sql.id === this.currentSqlId);
    
    if (sqlIndex !== -1) {
      // Update existing SQL execution
      this.sqlExecutions[sqlIndex] = {
        ...this.sqlExecutions[sqlIndex],
        results: toolOutput.results || toolOutput,
        status: toolOutput.error ? 'error' : 'completed',
        error: toolOutput.message
      };
    } else {
      // Create new SQL execution (for resume scenarios)
      const newSqlExecution: SqlExecution = {
        id: this.currentSqlId,
        purpose: 'Query execution',
        query: '', // We don't have the query in resume scenario, will be merged with existing
        results: toolOutput.results || toolOutput,
        status: toolOutput.error ? 'error' : 'completed',
        error: toolOutput.message,
        timestamp: new Date()
      };
      
      this.sqlExecutions.push(newSqlExecution);
    }
  } catch (error) {
    console.warn('Failed to parse tool output:', error);
    console.warn('Tool output content length:', this.currentToolOutput.length);
    console.warn('Tool output preview:', this.currentToolOutput.substring(0, 200) + '...');
    
    const sqlIndex = this.sqlExecutions.findIndex(sql => sql.id === this.currentSqlId);
    if (sqlIndex !== -1) {
      this.sqlExecutions[sqlIndex] = {
        ...this.sqlExecutions[sqlIndex],
        status: 'error',
        error: 'Failed to parse SQL output response'
      };
    } else {
      // Create error SQL execution for resume scenarios
      const errorSqlExecution: SqlExecution = {
        id: this.currentSqlId,
        purpose: 'Query execution',
        query: '',
        status: 'error',
        error: 'Failed to parse SQL output response',
        timestamp: new Date()
      };
      
      this.sqlExecutions.push(errorSqlExecution);
    }
  }
}

  private isSqlQuery(query: string): boolean {
    const sqlKeywords = [
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP',
      'DECLARE', 'WITH', 'MERGE', 'EXEC', 'EXECUTE', 'CALL'
    ];
    
    const upperQuery = query.toUpperCase().trim();
    const lines = upperQuery.split('\n');
    
    for (const line of lines.slice(0, 10)) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine || trimmedLine.startsWith('--') || trimmedLine.startsWith('/*')) {
        continue;
      }
      
      const startsWithSql = sqlKeywords.some(keyword => 
        trimmedLine.startsWith(keyword + ' ') || trimmedLine === keyword
      );
      
      if (startsWithSql) {
        return true;
      }
    }
    
    return false;
  }

  // Getter for individual content blocks (returns original individual blocks, not grouped)
  getContentBlocks(): ContentBlock[] {
    return [...this.contentBlocks];
  }

  // Getter for grouped content blocks
  getGroupedContentBlocks(): GroupedContentBlock[] {
    return this.groupConsecutiveBlocks(this.contentBlocks);
  }

  // Keep existing getters for backward compatibility
  getSqlExecutions(): SqlExecution[] {
    return [...this.sqlExecutions];
  }

  getThinkingBlocks(): ThinkingBlock[] {
    return [...this.thinkingBlocks];
  }
  
  getInterruptedQuery(): InterruptedQuery | null {
    return this.interruptedQuery;
  }
  
  isStreamInterrupted(): boolean {
    return this.isInterrupted;
  }
}