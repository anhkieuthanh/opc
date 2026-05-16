# Autonomous Agency Platform

This workspace is a brownfield integration of two existing systems:

- `paperclip/` is the control plane. It already owns orchestration, approvals, budgets, task history, and the operator-facing UI/API.
- `nanobot/` is the worker runtime. It already owns the Python agent loop, provider integrations, MCP/tool execution, and worker-side behavior.

The goal of this repository is to bring those two codebases into one governed platform without pretending they are already merged into a single runtime. The runtime bridge between them is planned, but it is not complete yet.

## Why Both Repos Exist

The split is intentional for Phase 1:

- `paperclip/` stays reusable as the company-level control plane.
- `nanobot/` stays reusable as the worker-level execution engine.
- The repo root is the coordination layer that documents how they fit together and gives contributors one place to start.

In short: Paperclip decides, tracks, and governs the work. Nanobot executes assigned work as a worker runtime.

## Workspace Structure

```text
.
├── paperclip/   # Node.js/TypeScript control plane and dashboard
└── nanobot/     # Python worker runtime and agent loop
```

## Local Development

Start from the repository root, then delegate into the subprojects.

### Prerequisites

- Node.js `>=20`
- `pnpm` for `paperclip/`
- Python `>=3.11`
- `uv` recommended for `nanobot/`

### First Commands

1. Run the root smoke check:

   ```bash
   npm run smoke
   ```

2. Start the Paperclip control plane:

   ```bash
   npm run dev:paperclip
   ```

3. Start Nanobot from the worker repo when you are ready to exercise worker behavior:

   ```bash
   npm run dev:nanobot
   ```

These root scripts are intentionally thin. They do not create a fake monorepo runtime and they do not imply that Paperclip already dispatches directly into Nanobot.

## Recommended Root-First Workflow

1. Begin at the root to understand the platform split and run `npm run smoke`.
2. Work inside `paperclip/` when changing orchestration, governance, API, or UI behavior.
3. Work inside `nanobot/` when changing worker execution, model/tool behavior, or Python runtime details.
4. Treat the future Paperclip-to-Nanobot bridge as a separate implementation phase, not as something already wired up.

## Root Commands

- `npm run smoke`: validate the workspace assumptions for both subprojects and print the expected boot sequence.
- `npm run dev:paperclip`: delegate to Paperclip's existing dev server.
- `npm run dev:nanobot`: delegate to a Nanobot local agent entrypoint.

## Smoke Check

Use the root smoke command any time you want a cheap sanity check before deeper work:

```bash
npm run smoke
```

The smoke script verifies that:

- `paperclip/package.json` exists
- `nanobot/pyproject.toml` exists
- the expected Paperclip dev scripts are present
- the Nanobot Python project metadata can be read

It also prints the expected local boot sequence for this brownfield workspace.
