import React, { useState, useEffect, FormEvent } from "react";
import { storeName } from "../consts";
import "../styles/scrollbar.css";
import "../styles/github.css";
import "../styles/github-dark.css";
import { type Conversation, type Message } from "../types";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { useAutoscroll } from "../hooks/useAutoscroll";
import { useStreamResponse } from "../hooks/useStreamResponse";

interface ConversationThreadProps {
  token?: string;
  conversations: Conversation[];
  conversationId?: number;
  setConversationId: (id: number) => void;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  db: any;
  credits?: number | null;
}

const ConversationThread: React.FC<ConversationThreadProps> = ({
  token,
  conversations,
  conversationId,
  setConversationId,
  setConversations,
  db,
}) => {
  const [input, setInput] = useState<string>("");
  const [reasoningEnabled, setReasoningEnabled] = useState(true);

  const { messagesEndRef, messagesContainerRef, scrollToBottom } =
    useAutoscroll();

  const {
    isLoading,
    setIsLoading,
    streamStarted,
    controller,
    streamResponse,
    aiResponseRef,
    aiReasoningRef,
  } = useStreamResponse({
    token,
    conversationId,
    setConversations,
    reasoningEnabled,
    scrollToBottom,
  });

  const currentConversation = conversations.find(
    (conv) => conv.id === conversationId
  ) || { messages: [], title: "" };

  const setShowMessageReasoning = (index: number, showReasoning: boolean) => {
    setConversations((prev) => {
      const updated = [...prev];
      const conv = updated.find((c) => c.id === conversationId);
      if (conv) {
        conv.messages[index].reasoning!.collapsed = showReasoning;
      }
      return updated;
    });
  };

  //when new message chunks are streamed in, scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [aiReasoningRef.current, aiResponseRef.current]);

  //when conversation changes, scroll to bottom
  useEffect(scrollToBottom, [conversationId]);

  //when conversation changes, reset input
  useEffect(() => {
    setInput("");
  }, [conversationId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (currentConversation.messages.length === 0) {
      setConversations((prev) => {
        const updated = [...prev];
        updated.unshift({
          id: conversationId,
          title: "New conversation",
          messages: [],
        });
        return updated;
      });
    }

    const userMessage: Message = { role: "user", content: input };

    setInput("");
    setIsLoading(true);

    setConversations((prev) => {
      const updated = [...prev];
      const conv = updated.find((c) => c.id === conversationId);
      if (conv) {
        conv.messages.push(userMessage);
      }
      return updated;
    });

    await streamResponse([...currentConversation.messages, userMessage]);

    setIsLoading(false);
  };

  const storeMessages = async () => {
    if (
      !currentConversation.messages ||
      currentConversation.messages.length === 0
    ) {
      return;
    }

    const store = db.transaction(storeName, "readwrite").objectStore(storeName);
    const objectData = {
      id: conversationId,
      title: currentConversation.title,
      messages: currentConversation.messages,
    };
    const value = await store.put(objectData);
    setConversationId(value);
  };

  useEffect(() => {
    if (db && conversationId) {
      storeMessages();
    }
  }, [conversations]);

  return (
    <div
      className={`flex flex-col h-[calc(100%-3rem)] w-full ${
        currentConversation.messages.length === 0 ? "justify-center" : ""
      }`}
    >
      <div
        ref={messagesContainerRef}
        className={`
        overflow-x-hidden
        ${
          currentConversation.messages.length === 0
            ? "flex items-center justify-center pb-6"
            : "flex-1 overflow-y-scroll"
        }`}
      >
        <div className="max-w-2xl mx-auto w-full px-4">
          {currentConversation.messages.length === 0 ? (
            <div className="text-center">
              <h1 className="text-4xl font-semibold text-zinc-800 dark:text-zinc-200">
                What do you want to know?
              </h1>
            </div>
          ) : (
            <div className="py-4 px-4 space-y-4">
              {currentConversation.messages.map((message, index) => (
                <ChatMessage
                  key={index}
                  message={message}
                  index={index}
                  setShowMessageReasoning={setShowMessageReasoning}
                />
              ))}
              {isLoading && !streamStarted && (
                <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
                  Thinking...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      <div
        className={`p-4 ${
          currentConversation.messages.length === 0 ? "pb-35" : ""
        }`}
      >
        <div className="max-w-2xl mx-auto">
          <ChatInput
            input={input}
            setInput={setInput}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            streamStarted={streamStarted}
            reasoningEnabled={reasoningEnabled}
            setReasoningEnabled={setReasoningEnabled}
            controller={controller}
            messagesCount={currentConversation.messages.length}
          />
        </div>
      </div>
    </div>
  );
};

export default ConversationThread;
