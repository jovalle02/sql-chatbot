import React from 'react';
import { motion } from 'framer-motion';

interface UserMessageProps {
  message: string;
  timestamp?: Date;
}

export const UserMessage: React.FC<UserMessageProps> = ({ message, timestamp }) => {
  return (
    <motion.div 
      className="flex justify-end mb-4"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-[80%] bg-black text-white rounded-2xl rounded-tr-md px-4 py-3 shadow-sm">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message}</p>
        {timestamp && (
          <p className="text-xs text-blue-100 mt-2 opacity-70">
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </motion.div>
  );
};