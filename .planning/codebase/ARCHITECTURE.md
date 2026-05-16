# Architecture

The workspace consists of two independent but complementary projects.

## Paperclip (The Company/Orchestrator)
Provides the control plane for autonomous agents.
- **Identity & Access**: Deployment modes, API keys, company memberships.
- **Org Chart & Agents**: Roles, reporting lines.
- **Work & Task System**: Issues, checkout, blocking, comments.
- **Heartbeat Execution**: DB-backed wakeup queue.
- **Budget Control**: Cost tracking and hard stops.

## Nanobot (The Employee/Agent)
A lightweight agent loop that can be managed by an orchestrator like Paperclip.
- **Core Loop**: Message ingest -> tool/MCP decision -> response.
- **Memory**: Token-based short-term and persistent long-term memory.
- **Channel Adapters**: Receives events from various IMs.
