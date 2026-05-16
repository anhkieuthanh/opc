# ADR 0001: Control-Plane and Worker Boundary

- Status: Accepted
- Date: 2026-05-16

## Context

This workspace combines two brownfield systems:

- `paperclip/` is the control plane for autonomous companies.
- `nanobot/` is the worker runtime that will execute assigned agent work.

Phase 1 needs one durable boundary before bridge code lands in Phase 2. The boundary must preserve Paperclip's governance model while narrowing Nanobot away from its standalone, channel-heavy product shape.

## Decision

Paperclip is the orchestration source of truth. Nanobot is the worker execution runtime.

Paperclip owns:

- task and run lifecycle initiation
- approvals and governed transitions
- budget enforcement and pause decisions
- company-scoped audit history
- the canonical record of assignment, progress, outputs, and failures visible to operators

Nanobot owns:

- worker bootstrapping and internal execution loop
- model, tool, and MCP orchestration inside a worker run
- local step-level reasoning and tool execution details
- runtime-specific retries or safeguards inside one dispatched run

Out of scope for the v1 content-agency path:

- direct peer-to-peer agent messaging
- Nanobot chat-channel surfaces as part of the active dispatch path
- treating Nanobot as a second control plane or system of record

## Consequences

- All operator-visible lifecycle state must reconcile back into Paperclip, even if Nanobot emits richer internal telemetry.
- Nanobot can evolve its internal runner shape without forcing Paperclip to adopt Nanobot-specific channel or UI concepts.
- Future bridge tests should assert that Paperclip can dispatch work, correlate worker results, and persist the auditable lifecycle without inspecting Nanobot internals.
- Channel pruning and deeper memory ownership changes remain later-phase work, but this boundary prevents Phase 2 from reintroducing them through the bridge.
