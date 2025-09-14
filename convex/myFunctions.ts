import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

// Chat functions for the AI assistant application
// These functions handle message storage and retrieval with user authentication

// Schema-aligned validators
const contentPart = v.object({
  type: v.union(v.literal("text"), v.literal("image"), v.literal("file")),
  text: v.optional(v.string()),
  url: v.optional(v.string()),
  alt: v.optional(v.string()),
});

const filePart = v.object({
  type: v.literal("file"),
  mediaType: v.string(),
  filename: v.optional(v.string()),
  url: v.string(),
});

const dynamicToolPart = v.object({
  type: v.literal("dynamic-tool"),
  errorText: v.optional(v.string()),
  input: v.optional(v.any()),
  output: v.optional(v.any()),
  state: v.union(
    v.literal("input-streaming"),
    v.literal("input-available"),
    v.literal("output-available"),
    v.literal("output-error"),
  ),
  toolName: v.string(),
  toolCallId: v.string(),
});
const reasoningPart = v.object({
  type: v.literal("reasoning"),
  text: v.string(),
  state: v.optional(v.union(v.literal("streaming"), v.literal("done"))),
  providerMetadata: v.optional(v.record(v.string(), v.any())),
});
const sourceDocumentPart = v.object({
  type: v.literal("source-document"),
  sourceId: v.string(),
  mediaType: v.string(),
  title: v.string(),
  filename: v.optional(v.string()),
  providerMetadata: v.optional(v.record(v.string(), v.any())),
});
const sourceUrlPart = v.object({
  type: v.literal("source-url"),
  sourceId: v.string(),
  url: v.string(),
  title: v.optional(v.string()),
  providerMetadata: v.optional(v.record(v.string(), v.any())),
});
const stepStartPart = v.object({
  type: v.literal("step-start"),
});
const textPart = v.object({
  type: v.literal("text"),
  text: v.string(),
  state: v.optional(v.union(v.literal("streaming"), v.literal("done"))),
});

export const messagePart = v.union(
  filePart,
  dynamicToolPart,
  reasoningPart,
  sourceDocumentPart,
  sourceUrlPart,
  stepStartPart,
  textPart,
);

const toolInvocation = v.object({
  state: v.union(v.literal("call"), v.literal("result")),
  toolCallId: v.string(),
  toolName: v.string(),
  args: v.any(),
  result: v.optional(v.any()),
});

// Get messages for the authenticated user
export const getMessages = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const raw = args.limit ?? 50;
    const limit = Math.max(1, Math.min(Math.floor(raw), 200));
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(limit);

    return {
      viewer: identity.name ?? null,
      messages: messages.reverse(), // Return in chronological order
    };
  },
});

// Add a user message (public API - only allows user role)
export const addUserMessage = mutation({
  args: {
    parts: v.array(v.any()),
    messageId: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    console.log("identity: addUserMessage", identity);
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const messageId = await ctx.db.insert("messages", {
      parts: args.parts,
      role: "user", // Force user role for public API
      userId: identity.subject,
      metadata: args.metadata,
    });

    console.log("Added new user message with id:", messageId);
    return messageId;
  },
});

// Add assistant/system/tool messages (internal API - allows all roles)
export const addAssistantMessage = internalMutation({
  args: {
    parts: v.array(messagePart),
    role: v.union(
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool"),
    ),
    userId: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      parts: args.parts,
      role: args.role,
      userId: args.userId,
      metadata: args.metadata,
    });

    console.log("Added new assistant message with id:", messageId);
    return messageId;
  },
});

// Add assistant message (public API - for server-side use)
export const addAssistantMessagePublic = mutation({
  args: {
    parts: v.array(v.any()),
    role: v.union(
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool"),
    ),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const messageId = await ctx.db.insert("messages", {
      parts: args.parts,
      role: args.role,
      userId: identity.subject,
      metadata: args.metadata,
    });

    console.log("Added new assistant message with id:", messageId);
    return messageId;
  },
});

// Legacy addMessage for backward compatibility - deprecated
export const addMessage = mutation({
  args: {
    parts: v.array(v.any()),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool"),
    ),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Only allow user role for public API
    if (args.role !== "user") {
      throw new Error(
        "Public API only allows user role. Use addUserMessage instead.",
      );
    }

    const messageId = await ctx.db.insert("messages", {
      parts: args.parts,
      role: args.role,
      userId: identity.subject,
      metadata: args.metadata,
    });

    console.log("Added new message with id:", messageId);
    return messageId;
  },
});

// Get messages count for the authenticated user
// WARNING: This function collects all documents and may be slow on large histories.
// Consider implementing a separate messageCounts table that is incremented/decremented
// alongside inserts/deletes to provide O(1) counts for better scalability.
export const getMessagesCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const count = await ctx.db
      .query("messages")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect()
      .then((messages) => messages.length);

    return count;
  },
});

// Clear all messages for the authenticated user
export const clearMessages = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    let totalDeleted = 0;
    while (true) {
      const batch = await ctx.db
        .query("messages")
        .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
        .take(200);
      if (batch.length === 0) break;
      for (const m of batch) await ctx.db.delete(m._id);
      totalDeleted += batch.length;
    }

    console.log(
      `Cleared ${totalDeleted} messages for user ${identity.subject}`,
    );
    return totalDeleted;
  },
});

// TEMP: Remove once all callers are migrated
export const listNumbers = query({
  args: { count: v.number() },
  returns: v.object({
    viewer: v.union(v.string(), v.null()),
    numbers: v.array(v.number()),
  }),
  handler: () => {
    throw new Error("listNumbers is deprecated. Use getMessages.");
  },
});

export const addNumber = mutation({
  args: { value: v.number() },
  returns: v.id("messages"),
  handler: () => {
    throw new Error("addNumber is deprecated. Use addMessage.");
  },
});
