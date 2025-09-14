// src/components/ui/chat-title.tsx

import React from 'react';
import { motion } from 'framer-motion';

interface ChatTitleProps {
  title?: string;
  subtitle?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  animationDelay?: number;
}

const ChatTitle: React.FC<ChatTitleProps> = ({ 
  title = "Chat Assistant",
  className = '',
  size = 'md',
  animationDelay = 0
}) => {
  // Size configurations
  const sizeStyles = {
    sm: {
      title: 'text-xl font-semibold',
      spacing: 'mb-3',
      gap: 'gap-1',
      margin: 'ml-2' // Added margin property
    },
    md: {
      title: 'text-2xl font-semibold',
      spacing: 'mb-4',
      gap: 'gap-2',
      margin: 'ml-2' // Added margin property
    },
    lg: {
      title: 'text-4xl font-semibold',
      spacing: 'mb-5',
      gap: 'gap-3',
      margin: 'ml-2' // Added margin property
    }
  };

  const currentStyles = sizeStyles[size];

  // Animation variants
  const containerVariants = {
    hidden: { 
      opacity: 0,
      y: -20
    },
    visible: { 
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number], // Custom easing for smooth feel
        delay: animationDelay,
        staggerChildren: 0.1,
        delayChildren: animationDelay + 0.2
      }
    }
  } as const;

  const itemVariants = {
    hidden: { 
      opacity: 0,
      y: -10
    },
    visible: { 
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number]
      }
    }
  } as const;

  const containerClassName = `
    flex
    flex-col
    text-center
    ${currentStyles.gap}
    ${currentStyles.spacing}
    ${currentStyles.margin}
    ${className}
  `.replace(/\s+/g, ' ').trim();

  return (
    <motion.div
      className={containerClassName}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.h1 
        className={`${currentStyles.title} text-gray-900 flex items-center justify-center gap-3`}
        variants={itemVariants}
      >
        <span>{title}</span>
      </motion.h1>
    </motion.div>
  );
};

export default ChatTitle;