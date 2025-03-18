import { useState, useRef } from "react";
import { processDataStream } from "@ai-sdk/ui-utils";
import { type Message, type Conversation } from "../types";

interface UseStreamResponseProps {
  token?: string;
  conversationId?: number;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  reasoningEnabled: boolean;
  scrollToBottom: () => void;
}

export const useStreamResponse = ({
  token,
  conversationId,
  setConversations,
  reasoningEnabled,
  scrollToBottom,
}: UseStreamResponseProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [streamStarted, setStreamStarted] = useState(false);
  const [controller, setController] = useState(new AbortController());
  const aiResponseRef = useRef<string>("");
  const aiReasoningRef = useRef<string>("");

  const streamResponse = async (messages: Message[]) => {
    let aiResponse = "";
    let aiReasoning = "";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          messages,
          reasoning: reasoningEnabled,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate response");
      }

      const stream = await response.body;
      if (!stream) {
        throw new Error("Failed to generate response");
      }

      setConversations((prev) => {
        const updated = [...prev];
        const conv = updated.find((c) => c.id === conversationId);
        if (conv) {
          conv.messages.push({ role: "assistant", content: "" });
        }
        return updated;
      });
      setStreamStarted(true);

      await processDataStream({
        stream,
        onTextPart: (chunk) => {
          try {
            aiResponse += chunk;
            aiResponseRef.current = aiReasoning;

            //custom extraction of <chat-title> tag
            const titleMatch = aiResponse.match(
              /<chat-title>(.*?)<\/chat-title>/
            );
            if (titleMatch) {
              const title = titleMatch[1].trim();
              setConversations((prev) => {
                const updated = [...prev];
                const conv = updated.find((c) => c.id === conversationId);
                if (conv) {
                  conv.title = title;
                }
                return updated;
              });
              aiResponse = aiResponse
                .replace(/<chat-title>.*?<\/chat-title>/, "")
                .trim();
            }

            setConversations((prev) => {
              const updated = [...prev];
              const conv = updated.find((c) => c.id === conversationId);
              if (conv) {
                conv.messages[conv.messages.length - 1].content = aiResponse;
              }
              return updated;
            });

            scrollToBottom();
          } catch (e) {
            console.log("Error in text part", e);
          }
        },
        onReasoningPart: (chunk) => {
          try {
            aiReasoning += chunk;
            aiReasoningRef.current = aiReasoning;

            setConversations((prev) => {
              const updated = [...prev];
              const conv = updated.find((c) => c.id === conversationId);
              if (conv) {
                conv.messages[conv.messages.length - 1].reasoning = {
                  collapsed: false,
                  content: aiReasoning,
                };
              }
              return updated;
            });
          } catch (e) {
            console.log("Error in reasoning part", e);
          }
        },
      });
    } catch (error: any) {
      if (controller.signal.aborted) {
        console.log("Stream aborted");
      } else {
        console.error("Error generating response:", error);
      }
    } finally {
      setStreamStarted(false);
      setController(new AbortController());
      return aiResponse;
    }
  };

  return {
    isLoading,
    setIsLoading,
    streamStarted,
    controller,
    streamResponse,
    aiResponseRef,
    aiReasoningRef,
  };
};
