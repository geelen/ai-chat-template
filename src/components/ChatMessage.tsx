import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { ChevronDown, ChevronRight } from "lucide-react";
import { type Message } from "../types";

interface ChatMessageProps {
  message: Message;
  index: number;
  setShowMessageReasoning: (index: number, showReasoning: boolean) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  index,
  setShowMessageReasoning,
}) => {
  return (
    <div
      className={`flex ${
        message.role === "user" ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={` 
        ${
          message.role === "user"
            ? "max-w-[80%] rounded-2xl px-3 py-2 border border-zinc-200/10 bg-zinc-100 text-black"
            : " text-zinc-900 w-full"
        }`}
      >
        {message.reasoning && (
          <div className="mb-2">
            <button
              onClick={() =>
                setShowMessageReasoning(index, !message.reasoning!.collapsed)
              }
              className="flex items-center text-xs text-zinc-500 hover:text-zinc-700"
            >
              {!message.reasoning.collapsed ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
              <span>Reasoning</span>
            </button>
            {!message.reasoning.collapsed && (
              <div className="text-xs text-zinc-500 mt-1">
                {message.reasoning.content}
              </div>
            )}
          </div>
        )}
        <div className="prose prose-zinc">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              table: ({ children }) => (
                <div className="overflow-x-scroll text-sm">{children}</div>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
