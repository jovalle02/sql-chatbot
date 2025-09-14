// pages/index.tsx or app/page.tsx
"use client"

import ChatBot from "@/components/chatbot";
import { SqlPanel } from "@/components/sql-panel";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SqlExecution } from "@/lib/content-parser";

export default function Home() {
  const [isSqlPanelOpen, setIsSqlPanelOpen] = useState(false);
  const [sqlExecutions, setSqlExecutions] = useState<SqlExecution[]>([]);

  // State to hold ChatBot's exposed handlers
  const [sqlHandlers, setSqlHandlers] = useState<{
    edit: (id: string, query: string, purpose: string) => void;
    resume: (id: string) => Promise<void>;
  } | null>(null);

  return (
    <main className="h-screen bg-gray-50 flex overflow-hidden">
      <motion.div
        className="flex items-center justify-center p-4 min-h-0"
        animate={{
          width: isSqlPanelOpen ? "70%" : "100%",
        }}
        transition={{
          duration: 0.4,
          ease: [0.4, 0, 0.2, 1]
        }}
      >
        <div className="w-full max-w-4xl h-fit max-h-[90vh] flex flex-col">
          <ChatBot 
            className="flex-1 min-h-0"
            onSqlPanelToggle={setIsSqlPanelOpen}
            isSqlPanelOpen={isSqlPanelOpen}
            sqlExecutions={sqlExecutions}
            setSqlExecutions={setSqlExecutions}
            onExposeHandlers={setSqlHandlers}
          />
        </div>
      </motion.div>

      {/* SQL Panel Container */}
      <AnimatePresence>
        {isSqlPanelOpen && (
          <motion.div
            className="bg-white border-l border-gray-200 shadow-xl"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "50%", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{
              duration: 0.4,
              ease: [0.4, 0, 0.2, 1]
            }}
          >
            <SqlPanel
              isOpen={true}
              onClose={() => setIsSqlPanelOpen(false)}
              sqlExecutions={sqlExecutions}
              className="h-full"
              onQueryEdit={sqlHandlers?.edit}
              onQueryResume={sqlHandlers?.resume}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}