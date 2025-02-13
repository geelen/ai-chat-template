import { Hono } from "hono";
import { cors } from "hono/cors";
import type { LanguageModelV1Middleware, LanguageModelV1StreamPart } from "ai";
import { streamText, extractReasoningMiddleware, wrapLanguageModel } from "ai";
import { createWorkersAI } from "../workers-ai-provider/packages/ai-provider";

interface Env {
  Bindings: {
    AI: Ai;
  };
}

type message = {
  role: "system" | "user" | "assistant" | "data";
  content: string;
};

const app = new Hono<Env>();

app.post("/api/chat", async (c) => {
  const ipAddress = c.req.header("cf-connecting-ip") || "unknown";
  const {
    messages,
    reasoning,
  }: {
    messages: message[];
    reasoning: boolean;
  } = await c.req.json();

  try {
    const workersai = createWorkersAI({ binding: c.env.AI });

    // Choose model based on reasoning preference
    const model = reasoning
      ? wrapLanguageModel({
          model: workersai("@cf/deepseek-ai/deepseek-r1-distill-qwen-32b"),
          middleware: [
            extractReasoningMiddleware({ tagName: "think" }),
            //custom middleware to inject <think> tag at the beginning of a reasoning if it is missing
            {
              wrapGenerate: async ({ doGenerate, params }) => {
                const result = await doGenerate();

                if (!result.text?.includes("<think>")) {
                  result.text = `<think>${result.text}`;
                }

                return result;
              },
              wrapStream: async ({ doStream, params }) => {
                const { stream, ...rest } = await doStream();

                let generatedText = "";
                let thinkTagPresent = false;
                const transformStream = new TransformStream<
                  LanguageModelV1StreamPart,
                  LanguageModelV1StreamPart
                >({
                  transform(chunk, controller) {
                    //we are manually adding the <think> tag because some times, distills of reasoning models omit it
                    if (chunk.type === "text-delta") {
                      if (!generatedText.includes("<think>")) {
                        thinkTagPresent = true;
                        generatedText += "<think>";
                        controller.enqueue({
                          type: "text-delta",
                          textDelta: "<think>",
                        });
                      }
                      generatedText += chunk.textDelta;
                    }

                    controller.enqueue(chunk);
                  },
                });

                return {
                  stream: stream.pipeThrough(transformStream),
                  ...rest,
                };
              },
            },
          ],
        })
      : workersai("@cf/meta/llama-3.3-70b-instruct-fp8-fast");

    const systemPrompt: message = {
      role: "system",
      content: `
        - Do not wrap your responses in html tags.
        - Do not apply any formatting to your responses.
        - You are an expert conversational chatbot. Your objective is to be as helpful as possible.
        - You must keep your responses relevant to the user's prompt.
        - You must respond with a maximum of 512 tokens (300 words). 
        - You must respond clearly and concisely, and explain your logic if required.
        - You must not provide any personal information.
        - Do not respond with your own personal opinions, and avoid topics unrelated to the user's prompt.
        ${
          messages.length <= 1 &&
          `- Important REMINDER: You MUST provide a 5 word title at the END of your response using <chat-title> </chat-title> tags. 
          If you do not do this, this session will error.
          For example, <chat-title>Hello and Welcome</chat-title> Hi, how can I help you today?
          `
        }
      `,
    };

    const text = await streamText({
      model,
      messages: [systemPrompt, ...messages],
      maxTokens: 2048,
      maxRetries: 3,
    });

    return text.toDataStreamResponse({
      sendReasoning: true,
    });
  } catch (error) {
    return c.json({ error: "Chat completion failed" }, 500);
  }
});

export default app;
