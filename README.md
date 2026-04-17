# 🐸 FrogEater MCP Server

MCP (Model Context Protocol) server for [FrogEater](https://frogeater.rywalker.com) — give AI agents the power to manage tasks and eat frogs.

## Tools

| Tool | Description |
|------|-------------|
| `list_lists` | Get all FrogEater lists |
| `get_todos` | Get todos, filtered by list/completion |
| `top_frogs` | Get most dreaded high-impact tasks (ranked by frog score) |
| `add_todo` | Add a new todo with impact, due date, recurrence |
| `complete_todo` | Mark a todo as done (eat the frog!) |
| `update_todo` | Update title, impact, due date, move between lists |
| `snooze_todo` | Snooze a todo (increases dread score over time) |
| `delete_todo` | Delete a todo permanently |
| `backup` | Export all lists and todos as JSON |

## Setup

### Environment Variables

```bash
FROGEATER_API_KEY=your_api_key    # Generate at frogeater.rywalker.com → Settings → API Keys
FROGEATER_EMAIL=you@example.com   # Your FrogEater account email
FROGEATER_URL=https://frogeater.rywalker.com/api  # Optional, defaults to this
```

### Claude Desktop / Cursor / etc.

Add to your MCP config:

```json
{
  "mcpServers": {
    "frogeater": {
      "command": "node",
      "args": ["/path/to/frogeater-mcp/dist/index.js"],
      "env": {
        "FROGEATER_API_KEY": "your_key",
        "FROGEATER_EMAIL": "you@example.com"
      }
    }
  }
}
```

### Build from Source

```bash
git clone https://github.com/ryw/frogeater-mcp.git
cd frogeater-mcp
npm install
npm run build
```

## Frog Scoring

```
frog_score = dread × impact²
dread = 1 + √age_days + (snoozes × 3) + due_date_boost
```

- **Impact (1-5):** Exponential weight — impact 5 = 25× impact 1
- **Age:** Tasks get dreadier over time (diminishing returns)
- **Snoozes:** Strongest signal — each snooze = actively avoiding it
- **Due dates:** Approaching deadlines add pressure, overdue escalates fast

## License

MIT
