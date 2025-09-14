// src/components/ui/custom-toggle-group.tsx

import React, { useState } from 'react';
import { motion } from 'framer-motion';

export interface ToggleOption {
  id: string;
  label: string;
  tooltip: string;
  icon?: React.ReactNode;
  // Optional metadata for dropdown/radio-style selectors
  badge?: string; // e.g., "Balanced", "Fastest", "Most Control"
  description?: string; // e.g., helper text under the option
}

interface CustomToggleGroupProps {
  options: ToggleOption[];
  value?: string;
  onChange?: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const CustomToggleGroup: React.FC<CustomToggleGroupProps> = ({
  options,
  value,
  onChange,
  size = 'md',
  className = ''
}) => {
  const [selectedValue, setSelectedValue] = useState(value || options[0]?.id || '');
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);

  const handleSelect = (optionId: string) => {
    setSelectedValue(optionId);
    onChange?.(optionId);
  };

  // Size configurations
  const sizeStyles = {
    sm: {
      container: 'h-8',
      button: 'px-3 py-1 text-xs',
      tooltip: 'text-xs px-2 py-1'
    },
    md: {
      container: 'h-10',
      button: 'px-4 py-2 text-sm',
      tooltip: 'text-sm px-3 py-1.5'
    },
    lg: {
      container: 'h-12',
      button: 'px-5 py-2.5 text-base',
      tooltip: 'text-base px-4 py-2'
    }
  };

  const currentStyles = sizeStyles[size];

  const containerClassName = `
    relative
    inline-flex
    bg-gray-100
    rounded-lg
    p-1
    ${currentStyles.container}
    ${className}
  `.replace(/\s+/g, ' ').trim();

  return (
    <div className={containerClassName}>
      {/* Toggle Options */}
      {options.map((option, index) => {
        const isSelected = selectedValue === option.id;
        
        return (
          <div
            key={option.id}
            className="relative"
            onMouseEnter={() => setHoveredTooltip(option.tooltip)}
            onMouseLeave={() => setHoveredTooltip(null)}
          >
            <motion.button
              type="button"
              onClick={() => handleSelect(option.id)}
              className={`
                relative
                z-10
                flex
                items-center
                gap-2
                font-medium
                transition-all
                duration-200
                rounded-md
                whitespace-nowrap
                ${currentStyles.button}
                ${isSelected 
                  ? 'text-gray-900' 
                  : 'text-gray-600 hover:text-gray-900'
                }
              `.replace(/\s+/g, ' ').trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {option.icon && (
                <span className="flex-shrink-0">
                  {option.icon}
                </span>
              )}
              <span>{option.label}</span>
            </motion.button>

            {/* Background highlight for selected option */}
            {isSelected && (
              <motion.div
                layoutId="toggle-background"
                className="absolute inset-0 bg-white rounded-md shadow-sm"
                initial={false}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 30
                }}
              />
            )}

            {/* Tooltip */}
            {hoveredTooltip === option.tooltip && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className={`
                  absolute
                  bottom-full
                  left-1/2
                  transform
                  -translate-x-1/2
                  mb-2
                  bg-gray-900
                  text-white
                  rounded-md
                  shadow-lg
                  whitespace-nowrap
                  z-50
                  ${currentStyles.tooltip}
                `.replace(/\s+/g, ' ').trim()}
              >
                {option.tooltip}
                {/* Tooltip arrow */}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2">
                  <div className="border-4 border-transparent border-t-gray-900"></div>
                </div>
              </motion.div>
            )}
          </div>
        );
      })}
    </div>
  );
};