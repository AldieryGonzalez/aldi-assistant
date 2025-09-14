import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Chat functions for the AI assistant application
// These functions handle message storage and retrieval with user authentication

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

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(args.limit ?? 50);

    return {
      viewer: identity.name ?? null,
      messages: messages.reverse(), // Return in chronological order
    };
  },
});

// Add a new message for the authenticated user
export const addMessage = mutation({
  args: {
    content: v.union(v.string(), v.array(v.any())),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool"),
    ),
    toolInvocations: v.optional(v.array(v.any())),
    fileParts: v.optional(v.array(v.any())),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const messageId = await ctx.db.insert("messages", {
      content: args.content,
      role: args.role,
      userId: identity.subject,
      createdAt: Date.now(),
      toolInvocations: args.toolInvocations,
      fileParts: args.fileParts,
      metadata: args.metadata,
    });

    console.log("Added new message with id:", messageId);
    return messageId;
  },
});

// Get messages count for the authenticated user
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

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    console.log(
      `Cleared ${messages.length} messages for user ${identity.subject}`,
    );
    return messages.length;
  },
});
