// src/components/ui/custom-textbox.tsx

import React, { forwardRef, useCallback, useEffect, useRef } from 'react';
import { ToggleOption } from './custom-toggle-group';
import { CustomRadioDropdown } from './custom-radio-dropdown';

interface CustomTextboxProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
  maxLines?: number;
  toggleOptions?: ToggleOption[];
  toggleValue?: string;
  onToggleChange?: (value: string) => void;
}

const CustomTextbox = forwardRef<HTMLTextAreaElement, CustomTextboxProps>(
  ({ 
    className = '', 
    size = 'md', 
    children, 
    maxLines = 16, 
    toggleOptions,
    toggleValue,
    onToggleChange,
    ...props 
  }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    // Auto-resize function - expands downward
    const autoResize = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      
      // Get computed styles
      const computedStyle = window.getComputedStyle(textarea);
      const lineHeight = parseInt(computedStyle.lineHeight);
      const paddingTop = parseInt(computedStyle.paddingTop);
      const paddingBottom = parseInt(computedStyle.paddingBottom);
      
      // Calculate minimum height (single line) and maximum height
      const minHeight = lineHeight + paddingTop + paddingBottom;
      const maxHeight = lineHeight * maxLines + paddingTop + paddingBottom;
      
      // Reset to minimum height first to get accurate scrollHeight
      textarea.style.height = `${minHeight}px`;
      
      // Calculate new height based on content, constrained by min and max
      const contentHeight = textarea.scrollHeight;
      const newHeight = Math.max(minHeight, Math.min(contentHeight, maxHeight));
      
      // Apply the new height
      textarea.style.height = `${newHeight}px`;
      
      // Set overflow based on whether we've hit the max height
      textarea.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
    }, [maxLines]);

    // Handle ref forwarding
    useEffect(() => {
      if (ref) {
        if (typeof ref === 'function') {
          ref(textareaRef.current);
        } else {
          ref.current = textareaRef.current;
        }
      }
    }, [ref]);

    // Auto-resize on content change and component mount
    useEffect(() => {
      autoResize();
    }, [props.value, autoResize]);

    // Initial resize on mount
    useEffect(() => {
      autoResize();
    }, [autoResize]);

    // Simplified size styles - Claude-like layout
    const sizeStyles = {
      sm: {
        container: 'p-3',
        textarea: 'text-sm leading-5 min-h-[20px]',
        iconContainer: 'mt-2',
        bottomRow: 'mt-2'
      },
      md: {
        container: 'p-4',
        textarea: 'text-base leading-6 min-h-[24px]',
        iconContainer: 'mt-3',
        bottomRow: 'mt-3'
      },
      lg: {
        container: 'p-5',
        textarea: 'text-lg leading-7 min-h-[28px]',
        iconContainer: 'mt-4',
        bottomRow: 'mt-4'
      }
    };

    const currentStyles = sizeStyles[size];

    // Adjust textarea padding based on whether we have toggle options
    const textareaPadding = toggleOptions ? '' : 'pr-14';

    const containerClassName = `
      relative
      w-full
      rounded-xl
      border
      transition-all
      duration-200
      ease-in-out
      focus-within:ring-2
      focus-within:ring-offset-2
      ${currentStyles.container}
      ${className}
    `.replace(/\s+/g, ' ').trim();

    const textareaClassName = `
      w-full
      bg-transparent
      border-none
      outline-none
      focus:outline-none
      focus:ring-0
      resize-none
      overflow-y-auto
      ${currentStyles.textarea}
      ${textareaPadding}
    `.replace(/\s+/g, ' ').trim();

    return (
      <div className={containerClassName}>
        <style jsx>{`
          /* Custom scrollbar styles for webkit browsers */
          textarea::-webkit-scrollbar {
            width: 6px;
          }
          
          textarea::-webkit-scrollbar-track {
            background: transparent;
          }
          
          textarea::-webkit-scrollbar-thumb {
            background-color: #d1d5db;
            border-radius: 3px;
          }
          
          textarea::-webkit-scrollbar-thumb:hover {
            background-color: #9ca3af;
          }
          
          /* SOLUTION: Reserve space for scrollbar to prevent text shifting */
          textarea {
            scrollbar-width: thin;
            scrollbar-color: #d1d5db transparent;
            scrollbar-gutter: stable; /* Modern browsers - reserves scrollbar space */
            /* Start with overflow hidden, will be set dynamically */
            overflow-y: hidden;
          }
          
          /* Fallback for older browsers - always show scrollbar space when scrolling */
          @supports not (scrollbar-gutter: stable) {
            textarea {
              overflow-y: auto;
            }
          }
        `}</style>
        
        <textarea
          ref={textareaRef}
          className={textareaClassName}
          onInput={autoResize}
          rows={1}
          {...props}
        />
        
        {/* Bottom row with toggle group and send button */}
        {(toggleOptions || children) && (
          <div className={`flex items-center justify-between ${currentStyles.bottomRow}`}>
            {/* Toggle Group on the left */}
            {toggleOptions && (
              <CustomRadioDropdown
                options={toggleOptions}
                value={toggleValue}
                onChange={onToggleChange}
                size={size}
              />
            )}
            
            {/* Spacer if no toggle options */}
            {!toggleOptions && <div />}
            
            {/* Send button on the right */}
            {children && (
              <div className="flex justify-end">
                {children}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

CustomTextbox.displayName = 'CustomTextbox';

export default CustomTextbox;