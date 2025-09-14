// src/components/ui/custom-radio-dropdown.tsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Dot, CheckCircle2 } from 'lucide-react';
import type { ToggleOption } from './custom-toggle-group';

interface CustomRadioDropdownProps {
  options: ToggleOption[];
  value?: string;
  onChange?: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  placeholder?: string;
}

export const CustomRadioDropdown: React.FC<CustomRadioDropdownProps> = ({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
  placeholder = 'Select option'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => {
    if (!options || options.length === 0) return undefined;
    const byValue = options.find(o => o.id === value);
    return byValue || options[0];
  }, [options, value]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Size styles
  const sizeStyles = {
    sm: {
      trigger: 'h-8 px-3 text-xs',
      panel: 'w-72 p-2',
      title: 'text-sm',
      badge: 'text-[10px] px-1.5 py-0.5',
      description: 'text-xs',
      tooltip: 'text-xs px-2 py-1'
    },
    md: {
      trigger: 'h-10 px-4 text-sm',
      panel: 'w-[22rem] p-2.5',
      title: 'text-sm',
      badge: 'text-[11px] px-2 py-0.5',
      description: 'text-sm',
      tooltip: 'text-sm px-3 py-1.5'
    },
    lg: {
      trigger: 'h-12 px-5 text-base',
      panel: 'w-[26rem] p-3',
      title: 'text-base',
      badge: 'text-xs px-2.5 py-0.5',
      description: 'text-base',
      tooltip: 'text-base px-4 py-2'
    }
  } as const;

  const current = sizeStyles[size];

  return (
    <div ref={containerRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(v => !v)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`inline-flex items-center gap-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors ${current.trigger}`.replace(/\s+/g, ' ').trim()}
      >
        {selected?.icon && <span className="text-gray-700">{selected.icon}</span>}
        <span className="text-gray-900 font-medium">
          {selected?.label || placeholder}
        </span>
        <ChevronDown className="ml-1 h-4 w-4 text-gray-500" />
      </button>

      {/* Trigger tooltip */}
      <AnimatePresence>
        {showTooltip && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white rounded-md shadow-lg whitespace-nowrap z-50 ${current.tooltip}`.replace(/\s+/g, ' ').trim()}
          >
            Choose your preferred level of control and interaction
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="border-4 border-transparent border-t-gray-900"></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className={`absolute z-50 bottom-full left-0 mb-2 rounded-lg border bg-white shadow-lg ${current.panel}`.replace(/\s+/g, ' ').trim()}
            role="listbox"
          >
            {options.map((opt) => {
              const isSelected = selected?.id === opt.id;
              return (
                <button
                  key={opt.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange?.(opt.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left rounded-md p-3 flex items-start gap-3 transition-colors ${isSelected ? 'bg-gray-50' : 'hover:bg-gray-50'}`.replace(/\s+/g, ' ').trim()}
                >
                  <span className="mt-0.5 text-gray-700">{opt.icon || <Dot className="h-5 w-5" />}</span>
                  <span className="flex-1">
                    <span className={`flex items-center gap-2 font-medium text-gray-900 ${current.title}`.replace(/\s+/g, ' ').trim()}>
                      {opt.label}
                      {opt.badge && (
                        <span className={`rounded-full bg-gray-100 text-gray-700 border border-gray-200 ${current.badge}`.replace(/\s+/g, ' ').trim()}>
                          {opt.badge}
                        </span>
                      )}
                    </span>
                    {opt.description && (
                      <span className={`block text-gray-600 ${current.description}`.replace(/\s+/g, ' ').trim()}>
                        {opt.description}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5">
                    {isSelected ? (
                      <CheckCircle2 className="h-5 w-5 text-gray-700" />
                    ) : (
                      <span className="h-5 w-5 inline-block rounded-full border border-gray-300" />
                    )}
                  </span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomRadioDropdown;


