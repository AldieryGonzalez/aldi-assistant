import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { messagePart } from "./myFunctions";

export default defineSchema({
  messages: defineTable({
    // Core message content - supporting both string and structured content parts
    parts: v.array(v.any()),

    // Message role (user, assistant, system, tool)
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool"),
    ),

    // User identification for authentication
    userId: v.string(),
    metadata: v.optional(v.any()),
  }).index("by_userId", ["userId"]),
});
