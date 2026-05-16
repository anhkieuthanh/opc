# Autonomous Agency Platform

## What This Is

An orchestration platform for autonomous AI companies that combines a Node.js/React control plane (from Paperclip) with Python-based AI worker agents (from Nanobot). The system allows a human "CEO" to define an org chart, set goals, and monitor progress via a dashboard, while specialized Python agents (e.g., Researcher, Writer) execute tasks and communicate strictly through the central orchestrator.

## Core Value

A unified, easily observable autonomous company environment where humans can orchestrate powerful Python-based LLM agents using a robust Node.js/React task management dashboard.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Node.js API and task queue system (from existing Paperclip code)
- ✓ React UI dashboard for monitoring agents (from existing Paperclip code)
- ✓ Python LLM interaction loop and MCP tool calling (from existing Nanobot code)
- ✓ Multiple LLM provider support in Python (from existing Nanobot code)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Create a polyglot monorepo structure separating the Node.js orchestrator and Python workers.
- [ ] Implement a REST API or WebSocket connection between Paperclip and Nanobot workers.
- [ ] Remove unused chat integrations (Telegram, Discord, etc.) from Nanobot.
- [ ] Remove unused DB/UI components from Nanobot, delegating state and memory entirely to Paperclip.
- [ ] Remove terminal/CLI specific agents from Paperclip.
- [ ] Implement the first use-case: Content Agency (Human CEO -> Manager/Editor -> Researcher Agent -> Writer Agent).

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- [Standalone Chatbots] — We are not building standard chatbots; agents must execute tasks assigned by the orchestrator.
- [Instant Messaging Integrations] — Removed from Nanobot to simplify the architecture; agents only talk to Paperclip.
- [Decentralized Agent Communication] — Agents cannot talk peer-to-peer; they must use the Paperclip task system to maintain a single source of truth.

## Context

- **Technical environment:** Node.js (TypeScript) for the control plane and React dashboard; Python 3.11+ for the AI agents.
- **Prior work:** Built by merging the cores of two open-source repositories (`paperclip` and `nanobot`).
- **First Use Case:** A Content Agency to validate task breakdown and handover between multiple specialized agents (Researcher and Writer).

## Constraints

- **Architecture**: Polyglot (Node.js + Python) — Must maintain clear API boundaries.
- **State Management**: Centralized — All state, memory, and task history must live in the Paperclip embedded Postgres database.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Polyglot Monorepo | Leverage Node.js for async orchestration/UI and Python for AI ecosystem/MCP tools. | — Pending |
| Centralized Orchestration | All inter-agent communication goes through Paperclip to ensure auditability and human oversight. | — Pending |
| Feature Pruning | Remove all chat channel integrations from Nanobot to focus purely on headless agent execution. | — Pending |
| First Milestone | Content Agency (Researcher + Writer workflow) selected as the initial vertical to prove out the system. | — Pending |

---
*Last updated: 2026-05-16 after initialization*
