import React from 'react';
import { Send, Loader2 } from 'lucide-react';

interface SendIconProps {
  isLoading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}

export const SendIcon: React.FC<SendIconProps> = ({ 
  isLoading = false,
  disabled = false,
  size = 'md', 
  onClick,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-4 h-4',
    lg: 'w-6 h-6'
  };

  const containerSizes = {
    sm: 'w-8 h-8',
    md: 'w-9 h-9',
    lg: 'w-12 h-12'
  };

  const handleClick = () => {
    if (!disabled && !isLoading && onClick) {
      onClick();
    }
  };

  const getBackgroundClasses = () => {
    if (disabled) {
      return 'bg-gray-200 cursor-not-allowed';
    }
    if (isLoading) {
      return 'bg-gray-100 cursor-default';
    }
    return 'bg-black hover:bg-gray-800 cursor-pointer';
  };

  const getIconColor = () => {
    if (disabled) {
      return 'text-gray-400';
    }
    if (isLoading) {
      return 'text-black';
    }
    return 'text-white';
  };

  return (
    <div 
      className={`
        relative 
        ${containerSizes[size]} 
        rounded-xl
        transition-all 
        duration-300 
        ease-out
        flex 
        items-center 
        justify-center
        ${getBackgroundClasses()}
        ${className}
      `}
      onClick={handleClick}
    >
      {/* Send Icon */}
      <Send 
        className={`
          ${sizeClasses[size]} 
          transition-all 
          duration-300 
          ease-in-out
          ${isLoading 
            ? 'opacity-0 scale-75' 
            : 'opacity-100 scale-100'
          }
          ${getIconColor()}
        `}
      />
      
      {/* Loading Spinner */}
      <Loader2 
        className={`
          absolute
          ${sizeClasses[size]} 
          text-gray-600
          transition-all 
          duration-300 
          ease-in-out
          animate-spin
          ${isLoading 
            ? 'opacity-100 scale-100' 
            : 'opacity-0 scale-75'
          }
        `}
      />
    </div>
  );
};