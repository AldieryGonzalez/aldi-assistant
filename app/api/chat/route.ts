import { auth } from "@clerk/nextjs/server";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Get the Clerk JWT token for Convex authentication
  const token = await getToken({ template: "convex" });
  if (!token) {
    return new Response("Failed to get authentication token", { status: 401 });
  }

  // Initialize Convex client with the user's authentication token
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!, {
    auth: token,
  });
  const {
    messages,
    model,
    webSearch,
  }: {
    messages: UIMessage[];
    model: string;
    webSearch: boolean;
  } = await req.json();
  // Get the latest user message
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== "user") {
    return new Response("Invalid request: last message must be from user", {
      status: 400,
    });
  }
  console.log("lastMessage", lastMessage);

  // Store the user message in Convex
  // Note: We use the public addUserMessage function which requires authentication
  // The Convex client will use the user's authentication token
  await convex.mutation(api.myFunctions.addUserMessage, {
    parts: lastMessage.parts,
    messageId: lastMessage.id,
    metadata: {
      timestamp: Date.now(),
      source: "chat-api",
      ...(lastMessage.metadata as object),
    },
  });

  const result = streamText({
    model: webSearch ? "perplexity/sonar" : openai("gpt-4o-mini"),
    messages: convertToModelMessages(messages),
    system:
      "You are a helpful assistant that can answer questions and help with tasks",
    onFinish: async (result) => {
      try {
        // Store the assistant's response in Convex using public mutation
        // The Convex client now has the user's authentication token
        await convex.mutation(api.myFunctions.addAssistantMessagePublic, {
          parts: result.text ? [{ type: "text", text: result.text }] : [],
          role: "assistant",
          metadata: {
            timestamp: Date.now(),
            source: "openai-api",
            model: "gpt-4o-mini",
            tokens: result.usage?.totalTokens,
            finishReason: result.finishReason,
          },
        });
      } catch (error) {
        console.error("Error adding assistant message:", error);
      }
    },
  });

  // send sources and reasoning back to the client
  return result.toUIMessageStreamResponse({
    sendSources: true,
    sendReasoning: true,
  });
}
