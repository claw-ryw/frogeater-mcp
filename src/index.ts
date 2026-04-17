#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.FROGEATER_URL || "https://frogeater.rywalker.com/api";
const API_KEY = process.env.FROGEATER_API_KEY || "";
const EMAIL = process.env.FROGEATER_EMAIL || "";

function getAuth(): string {
  if (!API_KEY || !EMAIL) {
    throw new Error("FROGEATER_API_KEY and FROGEATER_EMAIL must be set");
  }
  return `Bearer ${API_KEY}:${EMAIL}`;
}

async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: getAuth(),
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (res.status === 204) return { success: true };

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return JSON.parse(body);
}

// --- Server Setup ---

const server = new McpServer({
  name: "frogeater",
  version: "1.0.0",
});

// --- Tools ---

server.tool(
  "get_lists",
  "Get all FrogEater lists (Tembo, Personal, House, etc.)",
  {},
  async () => {
    const data = await apiFetch("/lists");
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(data.lists, null, 2),
      }],
    };
  }
);

server.tool(
  "get_todos",
  "Get todos, optionally filtered by list",
  {
    list_id: z.string().optional().describe("Filter by list UUID"),
    completed: z.boolean().optional().describe("Filter by completion status"),
    limit: z.number().optional().describe("Max results (default 100)"),
  },
  async ({ list_id, completed, limit }) => {
    const params = new URLSearchParams();
    if (list_id) params.set("list_id", list_id);
    if (completed !== undefined) params.set("completed", String(completed));
    if (limit) params.set("limit", String(limit));

    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await apiFetch(`/todos${query}`);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(data.todos, null, 2),
      }],
    };
  }
);

server.tool(
  "get_top_frogs",
  "Get the most dreaded high-impact tasks (frog_score = dread × impact²). These are the tasks you should tackle first.",
  {
    limit: z.number().optional().describe("Number of frogs to return (default 10)"),
    list_id: z.string().optional().describe("Filter by list UUID"),
  },
  async ({ limit, list_id }) => {
    const params = new URLSearchParams();
    if (limit) params.set("limit", String(limit));
    if (list_id) params.set("list_id", list_id);

    const query = params.toString() ? `?${params.toString()}` : "";
    const data = await apiFetch(`/frogs${query}`);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          frogs: data.frogs,
          total_incomplete: data.total_incomplete,
          formula: data.formula,
        }, null, 2),
      }],
    };
  }
);

server.tool(
  "add_todo",
  "Add a new todo to a FrogEater list",
  {
    title: z.string().describe("Todo title"),
    list_id: z.string().describe("List UUID to add to"),
    description: z.string().optional().describe("Optional description"),
    impact: z.number().min(1).max(5).optional().describe("Impact level 1-5 (1=minimal, 5=critical)"),
    due_date: z.string().optional().describe("Due date in YYYY-MM-DD format"),
    recurrence_days: z.number().optional().describe("Recurrence interval in days (e.g. 1=daily, 7=weekly, 30=monthly)"),
  },
  async ({ title, list_id, description, impact, due_date, recurrence_days }) => {
    const body: Record<string, unknown> = { title, list_id };
    if (description) body.description = description;
    if (impact) body.impact = impact;
    if (due_date) body.due_date = due_date;
    if (recurrence_days) body.recurrence_days = recurrence_days;

    const data = await apiFetch("/todos", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return {
      content: [{
        type: "text" as const,
        text: `✅ Added: "${data.todo.title}" (id: ${data.todo.id})`,
      }],
    };
  }
);

server.tool(
  "complete_todo",
  "Mark a todo as complete (eat the frog!)",
  {
    id: z.string().describe("Todo UUID to complete"),
  },
  async ({ id }) => {
    const data = await apiFetch(`/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        completed: true,
        completed_at: new Date().toISOString(),
      }),
    });
    return {
      content: [{
        type: "text" as const,
        text: `🐸 Frog eaten! Completed: "${data.todo.title}"`,
      }],
    };
  }
);

server.tool(
  "update_todo",
  "Update a todo's properties (title, impact, due date, list, etc.)",
  {
    id: z.string().describe("Todo UUID to update"),
    title: z.string().optional().describe("New title"),
    description: z.string().optional().describe("New description"),
    impact: z.number().min(1).max(5).optional().describe("Impact level 1-5"),
    due_date: z.string().optional().describe("Due date YYYY-MM-DD (set to empty string to clear)"),
    list_id: z.string().optional().describe("Move to different list UUID"),
    recurrence_days: z.number().optional().describe("Recurrence interval in days"),
  },
  async ({ id, ...updates }) => {
    // Filter out undefined values
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) {
        body[k] = v === "" ? null : v;
      }
    }

    const data = await apiFetch(`/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return {
      content: [{
        type: "text" as const,
        text: `✏️ Updated: "${data.todo.title}"`,
      }],
    };
  }
);

server.tool(
  "delete_todo",
  "Delete a todo permanently",
  {
    id: z.string().describe("Todo UUID to delete"),
  },
  async ({ id }) => {
    await apiFetch(`/todos/${id}`, { method: "DELETE" });
    return {
      content: [{
        type: "text" as const,
        text: `🗑️ Deleted todo ${id}`,
      }],
    };
  }
);

server.tool(
  "snooze_todo",
  "Snooze a todo (increments snooze count and sets snoozed_until)",
  {
    id: z.string().describe("Todo UUID to snooze"),
    hours: z.number().optional().describe("Hours to snooze (default 8)"),
  },
  async ({ id, hours = 8 }) => {
    const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

    // First get current snooze count
    const current = await apiFetch(`/todos/${id}`);
    const newSnoozeCount = (current.todo.times_snoozed || 0) + 1;

    const data = await apiFetch(`/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        times_snoozed: newSnoozeCount,
        snoozed_until: snoozedUntil,
        last_touched_at: new Date().toISOString(),
      }),
    });
    return {
      content: [{
        type: "text" as const,
        text: `💤 Snoozed "${data.todo.title}" for ${hours}h (snoozed ${newSnoozeCount}x total)`,
      }],
    };
  }
);

server.tool(
  "get_backup",
  "Export all lists and todos as JSON backup",
  {},
  async () => {
    const data = await apiFetch("/backup");
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      }],
    };
  }
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("FrogEater MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
