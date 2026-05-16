# Roadmap: Autonomous Agency Platform

## Overview

This roadmap turns two strong but separate codebases into one governed autonomous-company platform. The sequence starts by locking the shared workspace shape and bridge contract, then converts Nanobot into a focused headless worker, then specializes Paperclip for the first content-agency workflow, and finally verifies the whole operator-to-worker loop end to end.

## Phases

- [x] **Phase 1: Workspace Foundation and Contracts** - Establish brownfield monorepo boundaries, shared dev workflow, and the first bridge contract.
- [x] **Phase 2: Paperclip to Nanobot Bridge** - Implement the runtime/API path that lets Paperclip dispatch and supervise Nanobot work.
- [x] **Phase 3: Nanobot Headless Worker Mode** - Prune Nanobot into an orchestrator-managed worker shape for v1.
- [x] **Phase 4: Content Agency Orchestration** - Configure Paperclip workflows, roles, and routing for the first vertical.
- [x] **Phase 5: End-to-End Validation and Operator Experience** - Verify the integrated happy path, harden observability, and close the v1 loop. (completed 2026-05-16)

## Phase Details

### Phase 1: Workspace Foundation and Contracts
**Goal**: Define the root workspace shape, shared developer workflow, and contract boundaries so future implementation phases have one source of truth.
**Depends on**: Nothing (first phase)
**Requirements**: [ARCH-01, ARCH-02, ARCH-03, OPS-01]
**Success Criteria** (what must be TRUE):
  1. Developers can identify where Paperclip code ends and Nanobot worker code begins from the root workspace.
  2. A documented integration contract exists for dispatch, lifecycle, and output handoff between systems.
  3. A reproducible root-level setup and smoke-test path exists for the combined project.
**Plans**: 1 plan

Plans:
- [x] 01-01: Plan and scaffold the shared workspace foundation, root runbook, and bridge contract artifacts.

### Phase 2: Paperclip to Nanobot Bridge
**Goal**: Give Paperclip a real mechanism to invoke Nanobot workers and track run lifecycle through a governed bridge.
**Depends on**: Phase 1
**Requirements**: [BRDG-01, BRDG-02, BRDG-03]
**Success Criteria** (what must be TRUE):
  1. Paperclip can trigger Nanobot worker execution using the agreed bridge contract.
  2. Worker invocations include task context that can be traced back to Paperclip runs or issues.
  3. Operators can see success or failure state from bridge activity without inspecting Nanobot directly.
**Plans**: 1 plan

Plans:
- [x] 02-01: Build the bridge implementation and traceable lifecycle reporting between Paperclip and Nanobot.

### Phase 3: Nanobot Headless Worker Mode
**Goal**: Strip Nanobot down to the worker capabilities needed for orchestrated execution while preserving its useful agent core.
**Depends on**: Phase 2
**Requirements**: [NBOT-01, NBOT-02, NBOT-03]
**Success Criteria** (what must be TRUE):
  1. Nanobot can run for the v1 use case without external chat-channel dependencies.
  2. Worker configuration and state align with Paperclip as the orchestration system of record.
  3. Unused channel and UI surfaces are clearly disabled, removed, or isolated from the v1 path.
**Plans**: 1 plan

Plans:
- [x] 03-01: Refactor Nanobot into a focused headless worker profile for orchestrated execution.

### Phase 4: Content Agency Orchestration
**Goal**: Model the first content-agency workflow inside Paperclip using Nanobot-backed roles and governed task handoffs.
**Depends on**: Phase 3
**Requirements**: [PCLP-01, PCLP-02, FLOW-01, FLOW-02]
**Success Criteria** (what must be TRUE):
  1. An operator can configure and run the first content-agency role chain from Paperclip.
  2. Research and writing work is passed through Paperclip tasks rather than direct agent chatter.
  3. Terminal-only agent assumptions are removed from the active content-agency path.
**Plans**: 1 plan

Plans:
- [x] 04-01: Add the Paperclip-side orchestration and workflow setup for the content-agency vertical.

### Phase 5: End-to-End Validation and Operator Experience
**Goal**: Prove that the combined system works end to end and is observable enough for a human operator to trust.
**Depends on**: Phase 4
**Requirements**: [PCLP-03, FLOW-03, OPS-02]
**Success Criteria** (what must be TRUE):
  1. The content-agency happy path runs from operator assignment to visible reviewed output.
  2. Tests or repeatable checks cover the bridge contract and the first business workflow.
  3. The Paperclip dashboard exposes enough progress and failure detail for day-to-day supervision.
**Plans**: 1 plan

Plans:
- [x] 05-01: Verify, harden, and document the full operator-to-worker experience.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Workspace Foundation and Contracts | 1/1 | Complete | 2026-05-16 |
| 2. Paperclip to Nanobot Bridge | 1/1 | Complete | 2026-05-16 |
| 3. Nanobot Headless Worker Mode | 1/1 | Complete | 2026-05-16 |
| 4. Content Agency Orchestration | 1/1 | Complete | 2026-05-16 |
| 5. End-to-End Validation and Operator Experience | 1/1 | Complete   | 2026-05-16 |
