---
phase: 05-end-to-end-validation-and-operator-experience
plan: 01
subsystem: testing
tags: [vitest, embedded-postgres, pytest, aiohttp, supertest, integration-testing, bridge-contract]

# Dependency graph
requires:
  - phase: 04-content-agency-orchestration
    provides: Content Agency handoff endpoint, heartbeat persistence, HTTP bridge adapter, heartbeat-run-summary helpers
provides:
  - Embedded-Postgres E2E test covering full pm→researcher→writer chain (FLOW-03)
  - Bridge success/failure persistence assertions against real DB (PCLP-03)
  - Four named bridge contract it() assertions in execute.test.ts (OPS-02)
  - Nanobot idempotency pytest asserting session_key stability (OPS-02)
  - Operator smoke-test runbook at docs/runbooks/content-agency-smoke-test.md (OPS-02)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Embedded-Postgres E2E: real DB via startEmbeddedPostgresTestDatabase + vi.doMock for heartbeat wakeup mock + dynamic import in each test"
    - "Bridge persistence verification: call execute() with mocked fetch, then manually replicate executeRun persistence path (mergeHeartbeatRunResultJson + db.update + buildHeartbeatRunIssueComment)"
    - "Bridge contract named assertions: one it() per bridge contract implication in a dedicated describe block"
    - "Nanobot idempotency pytest: _run(coro) + aiohttp TestClient/TestServer + captured_keys assertion"

key-files:
  created:
    - paperclip/server/src/__tests__/content-agency-e2e.test.ts
    - docs/runbooks/content-agency-smoke-test.md
  modified:
    - paperclip/server/src/adapters/http/execute.test.ts
    - nanobot/tests/test_paperclip_bridge.py

key-decisions:
  - "Phase 5 adds tests only — no production code changes; all verification gaps are closed at the test layer"
  - "E2E persistence tests bypass heartbeat service internals (private executeRun) by calling execute() + mergeHeartbeatRunResultJson + db.update + buildHeartbeatRunIssueComment directly"
  - "HTTP adapter runs have logBytes=null so output_text reaches the operator via issue comment (activityLog issue.comment_added), not via transcript card — E2E asserts the comment path"
  - "Nanobot idempotency property tested as session_key stability (both calls use same key), not as cached-response deduplication (bridge re-executes)"

patterns-established:
  - "Embedded-Postgres E2E pattern: copy routines-e2e.test.ts setup verbatim (vi.resetModules + vi.doUnmock all + vi.doMock heartbeat wakeup + dynamic import of app per test)"
  - "Bridge contract assertions belong in a dedicated describe block with one named it() per testing implication from bridge doc"

requirements-completed: [PCLP-03, FLOW-03, OPS-02]

# Metrics
duration: 0min
completed: 2026-05-16
---

# Phase 5 Plan 01: End-to-End Validation and Operator Experience Summary

**Embedded-Postgres E2E covering the full pm→researcher→writer handoff chain, bridge success/failure persistence (resultJson + issue comment), four named bridge contract it() assertions, Nanobot idempotency pytest, and operator smoke-test runbook**

## Performance

- **Duration:** 0 min (all tasks were already committed prior to this executor run)
- **Started:** 2026-05-16T08:25:00Z
- **Completed:** 2026-05-16T08:26:04Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- Created `content-agency-e2e.test.ts` with 3 tests using real embedded Postgres: full chain handoff (FLOW-03), bridge success persistence verifying resultJson + issue comment (PCLP-03 D-03), and bridge failure persistence verifying errorCode (PCLP-03 D-04). All 3 pass.
- Added 4 named bridge contract `it()` blocks to `execute.test.ts` (one per bridge contract implication), plus Nanobot idempotency pytest `test_bridge_same_run_id_uses_same_session_key` to `test_paperclip_bridge.py`. All 10 Paperclip adapter tests and 5 Nanobot bridge tests pass.
- Created `docs/runbooks/content-agency-smoke-test.md` with 10 numbered steps for the full pm→researcher→writer smoke test, expected outcomes, and a failure triage table (122 lines).

## Task Commits

Each task was committed atomically:

1. **Task 1: Write content-agency-e2e.test.ts** - `ed273b6` (test)
2. **Task 2: Bridge contract assertions in execute.test.ts and idempotency pytest** - `728ae76` (test)
3. **Task 3: Create content-agency-smoke-test.md operator runbook** - `4b399fd` (docs)

## Files Created/Modified

- `paperclip/server/src/__tests__/content-agency-e2e.test.ts` - Embedded-Postgres E2E test: full chain + success/failure persistence assertions (3 it() blocks, all passing)
- `paperclip/server/src/adapters/http/execute.test.ts` - Added "bridge contract assertions" describe block with 4 named it() blocks (10 total tests, all passing)
- `nanobot/tests/test_paperclip_bridge.py` - Added `test_bridge_same_run_id_uses_same_session_key` idempotency test (5 total tests, all passing)
- `docs/runbooks/content-agency-smoke-test.md` - Operator manual smoke-test runbook (122 lines, 10 numbered steps, failure triage table)

## Decisions Made

- E2E tests bypass the private `executeRun` closure in heartbeat.ts by calling `execute()` + `mergeHeartbeatRunResultJson` + `db.update` + `buildHeartbeatRunIssueComment` directly. This replicates the persistence path without accessing non-exported internals.
- HTTP adapter runs produce `logBytes = null`, so `hasStoredOutput = false` in the UI. Writer `output_text` reaches the operator via the issue comment posted by `buildHeartbeatRunIssueComment`, not via the transcript card. E2E assertions verify `activityLog` for `issue.comment_added`.
- Nanobot idempotency guarantee is session_key stability (both calls with same `run_id` use `session_key = "paperclip:{run_id}"`), not terminal-status caching. The bridge re-executes using the same session memory.
- Bridge contract assertion describe block added to existing `execute.test.ts` (not a new file) to keep adapter-level contract assertions co-located with adapter unit tests.

## Deviations from Plan

None - all three tasks were already implemented and committed prior to this executor run. The executor verified the existing work against all acceptance criteria and confirmed all tests pass.

## Issues Encountered

None. All 3 content-agency-e2e.test.ts tests pass (including the embedded-Postgres chain test which takes ~1.9 seconds for DB setup). All 10 execute.test.ts tests pass. All 5 nanobot bridge tests pass.

## User Setup Required

None - no external service configuration required. Tests are fully self-contained (embedded Postgres, mocked fetch, aiohttp TestClient).

## Known Stubs

None. All test assertions verify real DB state or real response shapes. The smoke-test runbook is documentation, not a stub.

## Threat Flags

None. Phase 5 adds test code and documentation only. No new API endpoints, authentication surfaces, or schema changes.

## Next Phase Readiness

Phase 5 is the final phase. All requirements satisfied:
- PCLP-03: bridge success resultJson (including result.output_text) and issue comment persistence verified
- PCLP-03: bridge failure errorCode persistence verified
- FLOW-03: full pm→researcher→writer chain exercised against real embedded Postgres DB
- OPS-02: 4 named bridge contract assertions + 1 Nanobot idempotency pytest + operator runbook

The system is verified end to end. No blockers.

## Self-Check: PASSED

Files verified:
- FOUND: paperclip/server/src/__tests__/content-agency-e2e.test.ts
- FOUND: paperclip/server/src/adapters/http/execute.test.ts (bridge contract assertions describe block)
- FOUND: nanobot/tests/test_paperclip_bridge.py (test_bridge_same_run_id_uses_same_session_key)
- FOUND: docs/runbooks/content-agency-smoke-test.md

Commits verified:
- FOUND: ed273b6 (test(05-01): add content-agency E2E test with embedded Postgres)
- FOUND: 728ae76 (test(05-01): add bridge contract assertions and idempotency pytest)
- FOUND: 4b399fd (docs(05-01): add content-agency operator smoke-test runbook)

Test results verified:
- content-agency-e2e.test.ts: 3/3 tests passed
- execute.test.ts: 10/10 tests passed (including 4 new bridge contract assertions)
- test_paperclip_bridge.py: 5/5 tests passed (including new idempotency test)
- docs/runbooks/content-agency-smoke-test.md: 122 lines (within 50-150 range)

---
*Phase: 05-end-to-end-validation-and-operator-experience*
*Completed: 2026-05-16*
