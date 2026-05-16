# Requirements: Autonomous Agency Platform

**Defined:** 2026-05-16
**Core Value:** A unified, observable autonomous company platform where Paperclip orchestrates specialized Nanobot workers through one control plane.

## v1 Requirements

### Architecture Foundation

- [x] **ARCH-01**: Developers can work from one root workspace that clearly separates the Paperclip control plane and Nanobot worker runtime.
- [x] **ARCH-02**: The repository documents a single integration contract for how Paperclip dispatches, tracks, and supervises Nanobot workers.
- [x] **ARCH-03**: Local development setup defines a reproducible way to boot the Node.js and Python parts together.

### Control Plane to Worker Bridge

- [x] **BRDG-01**: Paperclip can start or signal a Nanobot worker through an auditable API or runtime bridge.
- [x] **BRDG-02**: Bridge requests carry enough task metadata for Nanobot to execute work tied to a Paperclip issue or run.
- [x] **BRDG-03**: Paperclip can observe worker lifecycle state and capture outputs or failures from the bridge.

### Nanobot Headless Worker Mode

- [x] **NBOT-01**: Nanobot can run in a headless worker mode without relying on chat-channel integrations.
- [x] **NBOT-02**: Non-essential chat adapters can be disabled or removed for the content-agency use case.
- [x] **NBOT-03**: Nanobot memory and state behavior can be aligned so Paperclip remains the system of record for orchestration history.

### Paperclip Orchestration UX

- [x] **PCLP-01**: Operators can configure Nanobot-backed workers in Paperclip without depending on terminal-only agent flows.
- [x] **PCLP-02**: Paperclip execution policy, approvals, and task routing work for the new worker type.
- [x] **PCLP-03**: Paperclip presents worker progress, outputs, and failures in the existing dashboard and audit trail.

### Content Agency Workflow

- [x] **FLOW-01**: A human operator can define a content-agency workflow with at least Manager or Editor, Researcher, and Writer roles.
- [x] **FLOW-02**: Research and writing work is handed off through Paperclip tasks instead of direct peer-to-peer agent communication.
- [x] **FLOW-03**: The content-agency happy path can be executed end to end from assignment to reviewed output.

### Verification and Operations

- [x] **OPS-01**: The integrated stack has a documented smoke-test path for boot, bridge, and happy-path execution.
- [x] **OPS-02**: Automated tests cover the bridge contract and the first content-agency workflow at an appropriate level.

## v2 Requirements

### Expansion

- **V2-01**: Support additional autonomous-company verticals beyond the first content agency.
- **V2-02**: Reintroduce selected external channels only when they can operate under Paperclip governance.
- **V2-03**: Support richer multi-worker collaboration patterns beyond researcher-to-writer handoff.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Standalone chatbot productization | Conflicts with the control-plane-first direction in PROJECT.md |
| Direct agent-to-agent messaging outside Paperclip | Breaks centralized auditability and orchestration |
| Keeping every Nanobot chat integration in v1 | Not needed for the first content-agency milestone |
| Rebuilding Paperclip or Nanobot from scratch | The project explicitly reuses both existing codebases |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ARCH-01 | Phase 1 | Complete |
| ARCH-02 | Phase 1 | Complete |
| ARCH-03 | Phase 1 | Complete |
| BRDG-01 | Phase 2 | Complete |
| BRDG-02 | Phase 2 | Complete |
| BRDG-03 | Phase 2 | Complete |
| NBOT-01 | Phase 3 | Complete |
| NBOT-02 | Phase 3 | Complete |
| NBOT-03 | Phase 3 | Complete |
| PCLP-01 | Phase 4 | Complete |
| PCLP-02 | Phase 4 | Complete |
| PCLP-03 | Phase 5 | Complete |
| FLOW-01 | Phase 4 | Complete |
| FLOW-02 | Phase 4 | Complete |
| FLOW-03 | Phase 5 | Complete |
| OPS-01 | Phase 1 | Complete |
| OPS-02 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-05-16*
*Last updated: 2026-05-16 after executing Phase 4 plan 04-01*
