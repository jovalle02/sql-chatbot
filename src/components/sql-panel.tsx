// src/components/ui/sql-panel.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Database, Clock, CheckCircle, AlertCircle, ChevronDown, Copy, Edit3, Play, AlertTriangle, Table, Check } from 'lucide-react';
import { SqlExecution } from '@/lib/content-parser';

// Define proper types for SQL results
type SqlResultRow = Record<string, unknown>;
type SqlResultSet = SqlResultRow[];

interface SqlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sqlExecutions: SqlExecution[];
  className?: string;
  // New props for editing interrupted queries
  onQueryEdit?: (queryId: string, newQuery: string, newPurpose: string) => void;
  onQueryResume?: (queryId: string) => Promise<void>;
}

export const SqlPanel: React.FC<SqlPanelProps> = ({ 
  isOpen, 
  onClose, 
  sqlExecutions, 
  className,
  onQueryEdit,
  onQueryResume
}) => {
  const [expandedQueries, setExpandedQueries] = useState<Set<string>>(new Set());
  const [editingQueries, setEditingQueries] = useState<Set<string>>(new Set());
  const [editedQueries, setEditedQueries] = useState<{[key: string]: {query: string, purpose: string}}>({});
  const [savingQueries, setSavingQueries] = useState<Set<string>>(new Set());
  const [resumingQueries, setResumingQueries] = useState<Set<string>>(new Set());
  const [tableViewMode, setTableViewMode] = useState<{[key: string]: 'table' | 'json'}>({});
  const [copiedButtons, setCopiedButtons] = useState<Set<string>>(new Set()); // Track which buttons were copied
  const copyTimeoutRef = useRef<Map<string, number>>(new Map()); // Track timeouts per button
  const [resultsPage, setResultsPage] = useState<{[key: string]: number}>({});
  const pageSize = 10; // default rows per page

  // Initialize purpose fields for interrupted queries
  useEffect(() => {
    setEditedQueries(prev => {
      const newObj = { ...prev };
      sqlExecutions.forEach(sql => {
        if (sql.status === 'interrupted' && !newObj[sql.id]) {
          newObj[sql.id] = { 
            query: sql.query, 
            purpose: sql.purpose || '' 
          };
        }
      });
      return newObj;
    });
  }, [sqlExecutions]);

  // Reset editing state when sqlExecutions change (after successful save)
  useEffect(() => {
    // Clear editing state for queries that no longer need editing
    setEditingQueries(prev => {
      const newSet = new Set<string>();
      prev.forEach(queryId => {
        const sql = sqlExecutions.find(s => s.id === queryId);
        // Keep editing state only if the query still exists and is still interrupted
        if (sql && sql.status === 'interrupted' && !savingQueries.has(queryId)) {
          newSet.add(queryId);
        }
      });
      return newSet;
    });

    // Clean up editedQueries for non-existent queries
    setEditedQueries(prev => {
      const newObj = { ...prev };
      Object.keys(newObj).forEach(queryId => {
        const sql = sqlExecutions.find(s => s.id === queryId);
        if (!sql || sql.status !== 'interrupted') {
          delete newObj[queryId];
        }
      });
      return newObj;
    });
  }, [sqlExecutions, savingQueries]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      copyTimeoutRef.current.forEach(timeoutId => {
        window.clearTimeout(timeoutId);
      });
      copyTimeoutRef.current.clear();
    };
  }, []);

  const toggleQuery = useCallback((queryId: string) => {
    setExpandedQueries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(queryId)) {
        newSet.delete(queryId);
      } else {
        newSet.add(queryId);
      }
      return newSet;
    });
  }, []);

  const toggleTableView = useCallback((queryId: string) => {
    setTableViewMode(prev => ({
      ...prev,
      [queryId]: prev[queryId] === 'table' ? 'json' : 'table'
    }));
  }, []);

  const startEditing = useCallback((queryId: string, query: string, purpose: string) => {
    setEditingQueries(prev => new Set([...prev, queryId]));
    setEditedQueries(prev => ({
      ...prev,
      [queryId]: { query, purpose: purpose || 'Query execution' }
    }));
  }, []);

  const cancelEditing = useCallback((queryId: string) => {
    setEditingQueries(prev => {
      const newSet = new Set(prev);
      newSet.delete(queryId);
      return newSet;
    });
    setEditedQueries(prev => {
      const newObj = { ...prev };
      delete newObj[queryId];
      return newObj;
    });
    setSavingQueries(prev => {
      const newSet = new Set(prev);
      newSet.delete(queryId);
      return newSet;
    });
  }, []);

  const saveEdits = useCallback(async (queryId: string) => {
    const edited = editedQueries[queryId];
    if (!edited || !onQueryEdit) {
      return;
    }

    setSavingQueries(prev => new Set([...prev, queryId]));

    try {
      // Call the parent's edit handler
      onQueryEdit(queryId, edited.query.trim(), edited.purpose.trim());
      
      // Clear editing state immediately after successful save
      setEditingQueries(prev => {
        const newSet = new Set(prev);
        newSet.delete(queryId);
        return newSet;
      });
      
      setEditedQueries(prev => {
        const newObj = { ...prev };
        delete newObj[queryId];
        return newObj;
      });
      
    } catch (error) {
      console.error('Failed to save edits:', error);
    } finally {
      setSavingQueries(prev => {
        const newSet = new Set(prev);
        newSet.delete(queryId);
        return newSet;
      });
    }
  }, [editedQueries, onQueryEdit]);

  const resumeQuery = useCallback(async (queryId: string) => {
    if (!onQueryResume) {
      return;
    }

    setResumingQueries(prev => new Set([...prev, queryId]));

    try {
      // First save any pending edits
      if (editingQueries.has(queryId)) {
        await saveEdits(queryId);
        // Wait a bit for the save to propagate
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      await onQueryResume(queryId);
    } catch (error) {
      console.error('Failed to resume query:', error);
    } finally {
      setResumingQueries(prev => {
        const newSet = new Set(prev);
        newSet.delete(queryId);
        return newSet;
      });
    }
  }, [editingQueries, saveEdits, onQueryResume]);

  const copyToClipboard = useCallback(async (text: string, buttonId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      
      // Mark this button as copied
      setCopiedButtons(prev => new Set([...prev, buttonId]));
      
      // Clear any existing timeout for this button
      const existingTimeout = copyTimeoutRef.current.get(buttonId);
      if (existingTimeout) {
        window.clearTimeout(existingTimeout);
      }
      
      // Set new timeout to revert the icon
      const timeoutId = window.setTimeout(() => {
        setCopiedButtons(prev => {
          const newSet = new Set(prev);
          newSet.delete(buttonId);
          return newSet;
        });
        copyTimeoutRef.current.delete(buttonId);
      }, 2000);
      
      copyTimeoutRef.current.set(buttonId, timeoutId);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, []);

  const handleInputChange = useCallback((queryId: string, field: 'query' | 'purpose', value: string) => {
    setEditedQueries(prev => ({
      ...prev,
      [queryId]: { 
        ...prev[queryId], 
        [field]: value 
      }
    }));
  }, []);

  const getStatusIcon = (status: SqlExecution['status']) => {
    switch (status) {
      case 'executing':
        return <Clock className="w-4 h-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      case 'interrupted':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Database className="w-4 h-4" />;
    }
  };

  const formatResults = (results?: unknown): string => {
    if (!results) return 'No results';
    
    if (Array.isArray(results)) {
      return JSON.stringify(results, null, 2);
    }
    
    if (typeof results === 'object') {
      return JSON.stringify(results, null, 2);
    }
    
    return String(results);
  };

  // Type guard with better typing
  const isTabularData = (results: unknown): results is SqlResultSet => {
    return Array.isArray(results) && 
           results.length > 0 && 
           results.every((row): row is SqlResultRow => 
             typeof row === 'object' && 
             row !== null && 
             !Array.isArray(row)
           );
  };

  // Component for animated copy button
  const CopyButton: React.FC<{ 
    buttonId: string; 
    onCopy: () => void; 
    title?: string;
    className?: string;
  }> = ({ buttonId, onCopy, title = "Copy", className = "" }) => {
    const isCopied = copiedButtons.has(buttonId);
    
    return (
      <button
        onClick={onCopy}
        className={`p-1 hover:bg-gray-200 rounded transition-all duration-200 ${className}`}
        title={isCopied ? "Copied!" : title}
      >
        <AnimatePresence mode="wait">
          {isCopied ? (
            <motion.div
              key="check"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Check className="w-3 h-3 text-green-600" />
            </motion.div>
          ) : (
            <motion.div
              key="copy"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Copy className="w-3 h-3 text-gray-500 hover:text-gray-700" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    );
  };

  const renderTableResults = (sqlId: string, results: SqlResultSet, page: number = 0, rowsPerPage: number = pageSize) => {
    if (results.length === 0) return null;

    // Get all unique columns from all rows
    const allColumns = Array.from(new Set(results.flatMap(row => Object.keys(row))));
    const total = results.length;
    const start = Math.max(0, Math.min(page, Math.ceil(total / rowsPerPage) - 1)) * rowsPerPage;
    const end = Math.min(start + rowsPerPage, total);
    const displayRows = results.slice(start, end);

    return (
      <div className="bg-white border border-gray-300 rounded-md overflow-hidden">
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {allColumns.map((column, index) => (
                  <th 
                    key={index}
                    className="px-3 py-2 text-left font-medium text-gray-600 border-b border-gray-200 whitespace-nowrap"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  {allColumns.map((column, colIndex) => {
                    const value = row[column];
                    const displayValue = value === null || value === undefined 
                      ? '-' 
                      : typeof value === 'object' 
                        ? JSON.stringify(value)
                        : String(value);
                    
                    return (
                      <td 
                        key={colIndex}
                        className="px-3 py-2 text-gray-800 border-b border-gray-100 max-w-xs"
                      >
                        <div className="truncate" title={displayValue}>
                          {displayValue}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > rowsPerPage && (
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600 flex items-center justify-between">
            <span>
              Rows {start + 1}-{end} of {total}
            </span>
            <div className="space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setResultsPage(prev => ({ ...prev, [sqlId]: Math.max(0, (prev[sqlId] || 0) - 1) }));
                }}
                className="px-2 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50"
                disabled={start === 0}
              >
                Prev
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const maxPage = Math.max(0, Math.ceil(total / rowsPerPage) - 1);
                  setResultsPage(prev => ({ ...prev, [sqlId]: Math.min(maxPage, (prev[sqlId] || 0) + 1) }));
                }}
                className="px-2 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50"
                disabled={end >= total}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderJsonArrayResults = (sqlId: string, results: unknown[], page: number = 0, rowsPerPage: number = 10) => {
    const total = results.length;
    const start = Math.max(0, Math.min(page, Math.ceil(total / rowsPerPage) - 1)) * rowsPerPage;
    const end = Math.min(start + rowsPerPage, total);
    const display = results.slice(start, end);

    return (
      <div className="bg-white border border-gray-300 rounded-md">
        <div className="p-3 max-h-60 overflow-y-auto">
          <div className="space-y-2">
            {display.map((row, index) => (
              <div key={start + index} className="text-xs">
                <div className="font-mono text-gray-600">Row {start + index + 1}:</div>
                <pre className="text-gray-800 ml-2">{JSON.stringify(row, null, 2)}</pre>
              </div>
            ))}
          </div>
        </div>
        {total > rowsPerPage && (
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600 flex items-center justify-between">
            <span>Rows {start + 1}-{end} of {total}</span>
            <div className="space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setResultsPage(prev => ({ ...prev, [sqlId]: Math.max(0, (prev[sqlId] || 0) - 1) }));
                }}
                className="px-2 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50"
                disabled={start === 0}
              >
                Prev
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const maxPage = Math.max(0, Math.ceil(total / rowsPerPage) - 1);
                  setResultsPage(prev => ({ ...prev, [sqlId]: Math.min(maxPage, (prev[sqlId] || 0) + 1) }));
                }}
                className="px-2 py-1 rounded border border-gray-300 text-gray-700 disabled:opacity-50"
                disabled={end >= total}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const getStatusLabel = (status: SqlExecution['status']) => {
    switch (status) {
      case 'executing':
        return 'Executing';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      case 'interrupted':
        return 'Interrupted';
      default:
        return 'Unknown';
    }
  };

  function capitalizeFirstLetter(val: string) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
  }

  // For the new layout, we'll render the panel directly without backdrop and positioning
  if (!isOpen) return null;

  return (
    <div className={`bg-white shadow-2xl flex flex-col relative ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Database className="w-5 h-5 text-gray-700" />
          <h2 className="text-lg font-semibold text-black">
            SQL Panel
          </h2>
          <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full" title="Total SQL executions" aria-label="Total SQL executions">
            {sqlExecutions.length} {sqlExecutions.length === 1 ? 'execution' : 'executions'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-md transition-all duration-200"
        >
          <X className="w-5 h-5 text-gray-600 hover:text-black transition-colors duration-200" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {sqlExecutions.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No SQL executions yet</p>
          </div>
        ) : (
          // Deduplicate SQL executions by ID before rendering
          Array.from(new Map(sqlExecutions.map(sql => [sql.id, sql])).values()).map((sql) => {
            const isEditing = editingQueries.has(sql.id);
            const canEdit = sql.status === 'interrupted';
            const canResume = sql.status === 'interrupted';
            const edited = editedQueries[sql.id] || { query: sql.query, purpose: sql.purpose || '' };
            const isSaving = savingQueries.has(sql.id);
            const isResuming = resumingQueries.has(sql.id);
            const canShowAsTable = sql.status === 'completed' && isTabularData(sql.results);
            const showAsTable = canShowAsTable && tableViewMode[sql.id] !== 'json';
            const currentPage = resultsPage[sql.id] || 0;

            return (
              <motion.div
                key={`sql-panel-${sql.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-lg border transition-all duration-200 ${
                  sql.status === 'interrupted' 
                    ? 'bg-gray-50 border-gray-300 hover:border-gray-400 hover:shadow-sm'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                {/* Query Header */}
                <div
                  className={`flex items-center justify-between p-3 cursor-pointer transition-all duration-200 rounded-t-lg ${
                    sql.status === 'interrupted' ? 'hover:bg-gray-100' : 'hover:bg-gray-100'
                  }`}
                  onClick={() => !isEditing && toggleQuery(sql.id)}
                >
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    {getStatusIcon(sql.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-black truncate">
                          {capitalizeFirstLetter(sql.purpose || '')}
                        </p>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          sql.status === 'interrupted' 
                            ? 'bg-gray-200 text-gray-700'
                            : sql.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : sql.status === 'error'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {getStatusLabel(sql.status)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {sql.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  
                  {/* Action buttons for interrupted queries - only show edit button for query editing */}
                  {canEdit && !isEditing && (
                    <div 
                      className="flex items-center space-x-2 mr-2" 
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          startEditing(sql.id, sql.query, sql.purpose || 'Query execution');
                        }}
                        className="p-1 hover:bg-gray-300 rounded text-gray-700 hover:text-gray-900 transition-colors"
                        title="Edit query"
                        disabled={isSaving || isResuming}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {!isEditing && (
                    <motion.div
                      animate={{ rotate: expandedQueries.has(sql.id) ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    </motion.div>
                  )}
                </div>

                {/* Expanded Content */}
                <AnimatePresence>
                  {(expandedQueries.has(sql.id) || isEditing) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden border-t border-gray-200"
                    >
                      <div className="p-3 space-y-3">
                        {/* SQL Query */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                              Query
                            </label>
                            {!isEditing && (
                              <CopyButton
                                buttonId={`query-${sql.id}`}
                                onCopy={() => copyToClipboard(sql.query, `query-${sql.id}`)}
                                title="Copy Query"
                              />
                            )}
                          </div>
                          
                          {isEditing ? (
                            <div className="space-y-3">
                              <textarea
                                value={edited.query}
                                onChange={(e) => handleInputChange(sql.id, 'query', e.target.value)}
                                className="w-full min-h-[120px] p-3 font-mono text-sm border border-gray-300 rounded-md focus:outline-none focus:border-gray-500 resize-y"
                                placeholder="Enter your SQL query..."
                                disabled={isSaving}
                              />
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    saveEdits(sql.id);
                                  }}
                                  disabled={!edited.query.trim() || isSaving}
                                  className="inline-flex cursor-pointer items-center space-x-2 px-3 py-2 bg-black hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-colors"
                                >
                                  {isSaving ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <span>{isSaving ? 'Saving...' : 'Save'}</span>
                                  )}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    cancelEditing(sql.id);
                                  }}
                                  className="inline-flex cursor-pointer items-center space-x-2 px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded-md transition-colors"
                                  disabled={isSaving}
                                >
                                  <span>Cancel</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <pre className={`p-3 rounded-md text-xs overflow-x-auto border ${
                                sql.status === 'interrupted' 
                                  ? 'bg-gray-200 border-gray-400' 
                                  : 'bg-white border-gray-300'
                              }`}>
                                <code>{sql.query}</code>
                              </pre>
                            </div>
                          )}
                        </div>

                        {/* Purpose/Feedback */}
                        {canEdit && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                                Feedback
                              </label>
                            </div>
                            <input
                              type="text"
                              value={""}
                              onChange={(e) => handleInputChange(sql.id, 'purpose', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-gray-500 text-sm"
                              placeholder="If you edited the query, adding a brief explanation of what you changed can help improve future results."
                              disabled={isSaving}
                            />
                            
                            {/* Resume button positioned right below the purpose field */}
                            <div className="mt-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  resumeQuery(sql.id);
                                }}
                                className="inline-flex items-center cursor-pointer space-x-2 px-3 py-2 bg-black hover:bg-gray-600 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
                                disabled={isResuming}
                              >
                                {isResuming && (
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                )}
                                <span>{isResuming ? 'Resuming...' : 'Resume'}</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Results */}
                        {sql.status === 'completed' && sql.results && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                                Results
                              </label>
                              <div className="flex items-center space-x-2">
                                {canShowAsTable && (
                                  <button
                                    onClick={() => toggleTableView(sql.id)}
                                    className={`p-1 hover:bg-gray-200 rounded transition-all duration-200 ${
                                      showAsTable ? 'text-gray-600 bg-gray-300' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                    title={showAsTable ? 'Switch to JSON view' : 'Switch to table view'}
                                  >
                                    <Table className="w-3 h-3" />
                                  </button>
                                )}
                                <CopyButton
                                  buttonId={`results-${sql.id}`}
                                  onCopy={() => copyToClipboard(formatResults(sql.results), `results-${sql.id}`)}
                                  title="Copy Results"
                                />
                              </div>
                            </div>
                            
                            {canShowAsTable && showAsTable ? (
                              renderTableResults(sql.id, sql.results as SqlResultSet, currentPage, pageSize)
                            ) : Array.isArray(sql.results) && sql.results.length > 0 ? (
                              renderJsonArrayResults(sql.id, sql.results as unknown[], currentPage, pageSize)
                            ) : (
                              <div className="bg-white border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto">
                                <pre className="text-xs text-gray-800">
                                  {formatResults(sql.results)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Error */}
                        {sql.status === 'error' && sql.error && (
                          <div>
                            <label className="text-xs font-medium text-red-600 uppercase tracking-wide mb-2 block">
                              Error
                            </label>
                            <div className="bg-red-50 border border-red-200 rounded-md p-3">
                              <pre className="text-xs text-red-700 break-words whitespace-pre-wrap">
                                {sql.error}
                              </pre>
                            </div>
                          </div>
                        )}

                        {/* Executing State */}
                        {sql.status === 'executing' && (
                          <div className="flex items-center space-x-2 text-gray-600">
                            <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs">Executing query...</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};