# Phase 1: Workspace Foundation and Contracts - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase defines how the combined workspace is organized and how Paperclip and Nanobot are expected to interact before any deep feature integration begins. It covers root-level project structure, shared run/setup expectations, and the first bridge contract artifacts, but it does not yet require a production-ready worker dispatch implementation.

</domain>

<decisions>
## Implementation Decisions

### Brownfield integration posture
- **D-01:** Preserve `paperclip/` and `nanobot/` as reusable brownfield cores instead of rewriting either system.
- **D-02:** Use the root repository as the coordination layer that explains boundaries, startup flow, and integration contract ownership.

### Source-of-truth boundaries
- **D-03:** Paperclip remains the control-plane source of truth for tasks, approvals, budgets, and orchestration history.
- **D-04:** Nanobot is being adapted into a worker runtime that executes assigned work rather than acting as a standalone multi-channel product in the v1 path.

### Scope constraints for this phase
- **D-05:** Phase 1 should lock workspace structure, runbook, and bridge contract shape before building the actual runtime bridge.
- **D-06:** Chat-channel pruning, memory realignment, and full content-agency workflow implementation are explicitly deferred to later phases.

### the agent's Discretion
- Exact root-level script names and workspace tooling choices
- Whether the bridge contract is expressed first as ADR, markdown spec, schema, or stub interface
- How much existing repo documentation should be linked versus copied into new root-level docs

</decisions>

<specifics>
## Specific Ideas

- Keep the Paperclip "company/control plane" framing and the Nanobot "employee/worker" framing because it matches the product story in both upstream repos.
- Favor thin integration seams over large cross-repo rewrites in the first phase.
- Make the root workflow obvious enough that a contributor does not need to guess whether to start in `paperclip/`, `nanobot/`, or the workspace root.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and planning
- `.planning/PROJECT.md` — Project scope, active goals, constraints, and out-of-scope boundaries
- `.planning/REQUIREMENTS.md` — Checkable v1 requirements mapped to roadmap phases
- `.planning/ROADMAP.md` — Phase sequencing and success criteria for the brownfield integration

### Existing codebase map
- `.planning/codebase/ARCHITECTURE.md` — High-level split between Paperclip as control plane and Nanobot as worker
- `.planning/codebase/STRUCTURE.md` — Directory layout of both codebases inside the workspace
- `.planning/codebase/INTEGRATIONS.md` — Current runtime, provider, and channel integrations that influence pruning decisions
- `.planning/codebase/CONCERNS.md` — Known duplication, environment, and integration risks
- `.planning/codebase/TESTING.md` — Existing test surfaces in both systems

### Brownfield source docs
- `paperclip/AGENTS.md` — Concrete engineering rules and dev workflow for the Paperclip side
- `paperclip/README.md` — Product model and orchestration capabilities that should stay central
- `nanobot/README.md` — Worker capabilities and channel-heavy scope that must be narrowed for v1

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `paperclip/server`, `paperclip/ui`, and `paperclip/packages/*`: existing control-plane runtime, UI, and shared contracts
- `nanobot/nanobot`, `nanobot/bridge`, and `nanobot/tests`: existing worker loop, possible bridge touchpoints, and Python test surface

### Established Patterns
- Paperclip already has strict company-scoped orchestration and documented verification expectations.
- Nanobot already has a lightweight agent core but carries many channel adapters and standalone UX surfaces.

### Integration Points
- The future bridge needs to connect Paperclip issue or run execution to a Nanobot worker lifecycle.
- Root-level docs and scripts must help developers move cleanly between `pnpm` and Python tooling without ambiguity.

</code_context>

<deferred>
## Deferred Ideas

- Removing Nanobot chat-channel integrations in code
- Reworking Nanobot memory ownership in detail
- Modeling the full content-agency role chain in Paperclip
- End-to-end operator verification and acceptance testing

</deferred>

---

*Phase: 01-workspace-foundation-and-contracts*
*Context gathered: 2026-05-16*
