import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const createDesktopDeviceLink = mutation({
  args: {
    codeHash: v.string(),
    now: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("desktopDeviceLinks")
      .withIndex("by_code_hash", (q) => q.eq("codeHash", args.codeHash))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "pending",
        githubLogin: undefined,
        createdAt: args.now,
        expiresAt: args.expiresAt,
        approvedAt: undefined,
        consumedAt: undefined,
      });
      return { ok: true };
    }

    await ctx.db.insert("desktopDeviceLinks", {
      codeHash: args.codeHash,
      status: "pending",
      createdAt: args.now,
      expiresAt: args.expiresAt,
    });

    return { ok: true };
  },
});

export const completeDesktopDeviceLink = mutation({
  args: {
    codeHash: v.string(),
    githubLogin: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("desktopDeviceLinks")
      .withIndex("by_code_hash", (q) => q.eq("codeHash", args.codeHash))
      .unique();

    if (!link) {
      return { status: "invalid" as const };
    }

    if (args.now > link.expiresAt) {
      await ctx.db.patch(link._id, { status: "expired" });
      return { status: "expired" as const };
    }

    if (link.status === "consumed") {
      return { status: "consumed" as const };
    }

    await ctx.db.patch(link._id, {
      status: "approved",
      githubLogin: args.githubLogin.toLowerCase(),
      approvedAt: args.now,
    });

    return { status: "approved" as const };
  },
});

export const pollDesktopDeviceLink = mutation({
  args: {
    codeHash: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("desktopDeviceLinks")
      .withIndex("by_code_hash", (q) => q.eq("codeHash", args.codeHash))
      .unique();

    if (!link) {
      return { status: "invalid" as const };
    }

    if (args.now > link.expiresAt) {
      if (link.status !== "expired" && link.status !== "consumed") {
        await ctx.db.patch(link._id, { status: "expired" });
      }
      return { status: "expired" as const };
    }

    if (link.status === "pending") {
      return { status: "pending" as const };
    }

    if (link.status === "approved") {
      if (!link.githubLogin) {
        return { status: "invalid" as const };
      }

      await ctx.db.patch(link._id, {
        status: "consumed",
        consumedAt: args.now,
      });

      return {
        status: "approved" as const,
        githubLogin: link.githubLogin,
      };
    }

    if (link.status === "consumed") {
      return { status: "consumed" as const };
    }

    return { status: "expired" as const };
  },
});
