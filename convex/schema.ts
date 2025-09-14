import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const contentPart = v.object({
  type: v.union(v.literal("text"), v.literal("image"), v.literal("file")),
  text: v.optional(v.string()),
  url: v.optional(v.string()),
  alt: v.optional(v.string()),
});

export default defineSchema({
  messages: defineTable({
    // Core message content - supporting both string and structured content parts
    content: v.union(v.string(), v.array(contentPart)),

    // Message role (user, assistant, system, tool)
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool"),
    ),

    // User identification for authentication
    userId: v.string(),

    // Timestamp for message ordering
    createdAt: v.number(),

    // Optional: Tool invocations for AI function calls - AI-SDK-compatible shape
    toolInvocations: v.optional(
      v.array(
        v.object({
          state: v.union(v.literal("call"), v.literal("result")),
          toolCallId: v.string(),
          toolName: v.string(),
          args: v.any(),
          result: v.optional(v.any()),
        }),
      ),
    ),

    // Optional: File parts for attachments - with storage linkage and normalized fields
    fileParts: v.optional(
      v.array(
        v.object({
          type: v.union(v.literal("file"), v.literal("image")),
          name: v.optional(v.string()),
          mimeType: v.optional(v.string()),
          size: v.optional(v.number()),
          storageId: v.optional(v.id("_storage")),
          url: v.optional(v.string()),
        }),
      ),
    ),

    // Optional: Additional metadata - relaxed to allow additional keys
    metadata: v.optional(v.any()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_createdAt", ["userId", "createdAt"]),
});
