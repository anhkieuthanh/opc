# Paperclip to Nanobot Bridge Contract

## Purpose

This document defines the first implementation contract for the v1 control-plane-to-worker bridge.

- Paperclip is the initiating system and orchestration source of truth.
- Nanobot is the worker runtime that accepts dispatched work and reports lifecycle results.
- Direct peer-to-peer agent communication is not part of this path.
- Nanobot's channel-heavy chat surfaces are not part of the v1 content-agency bridge.

The contract is implementation-agnostic for Phase 2. It can be realized through HTTP, process invocation, queue delivery, or another transport, as long as the payloads and lifecycle semantics below remain stable.

## Dispatch Trigger

Paperclip dispatches a worker run when all of the following are true:

1. A Paperclip issue or run is ready for execution.
2. The assigned worker maps to a Nanobot-backed adapter or runtime target.
3. Required approval and budget gates have already passed in Paperclip.

Nanobot does not self-start new governed work. It only executes work that Paperclip dispatches.

## Minimum Dispatch Payload

Each dispatch request must provide at least these fields:

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `dispatch_id` | string | yes | Unique per dispatch attempt. Stable correlation key across transport, logs, and callbacks. |
| `idempotency_key` | string | yes | Used by Nanobot to reject or safely coalesce duplicate dispatches. |
| `company_id` | string | yes | Preserves Paperclip company scope. |
| `issue_id` | string | yes | Canonical Paperclip work item identifier. |
| `issue_key` | string | no | Human-readable issue reference if available. |
| `run_id` | string | yes | Paperclip execution/run identifier for this dispatch. |
| `worker_id` | string | yes | Paperclip agent or worker identifier mapped to Nanobot runtime config. |
| `role` | string | yes | Expected worker role, such as `researcher` or `writer`. |
| `objective` | string | yes | Short execution goal for the worker. |
| `instructions` | string | yes | Full task body or compiled execution brief. |
| `input_artifacts` | array | no | References to documents, URLs, or prior outputs needed for execution. |
| `constraints` | object | no | Guardrails such as deadlines, tool restrictions, or output format requirements. |
| `budget` | object | no | Dispatch-scoped budget hints from Paperclip. Enforcement authority remains with Paperclip. |
| `callback` | object | no | Where Nanobot reports lifecycle updates if the transport is asynchronous. |
| `requested_at` | string | yes | ISO 8601 timestamp from Paperclip. |

## Lifecycle States

The bridge must support these worker-visible states:

| State | Meaning | Source |
|------|---------|--------|
| `accepted` | Nanobot accepted the dispatch and reserved or created a local run record. | Nanobot |
| `running` | Active worker execution has started. | Nanobot |
| `waiting_on_paperclip` | Worker cannot continue until Paperclip changes the issue state, provides approval, or supplies missing governed context. | Nanobot |
| `succeeded` | Worker completed and produced a terminal success payload. | Nanobot |
| `failed` | Worker reached a terminal error and produced a failure payload. | Nanobot |
| `cancelled` | Dispatch was cancelled by Paperclip or Nanobot acknowledged a control-plane stop request. | Paperclip or Nanobot |

Notes:

- Paperclip may maintain richer operator states, but bridge conformance must map cleanly onto this set.
- Nanobot-internal substeps, tool calls, or reasoning phases do not expand the public bridge state machine unless a later ADR changes the contract.

## Success Payload

On terminal success, Nanobot returns or posts a payload with at least:

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `dispatch_id` | string | yes | Must match the original dispatch. |
| `run_id` | string | yes | Must match the Paperclip run. |
| `status` | string | yes | Must be `succeeded`. |
| `completed_at` | string | yes | ISO 8601 timestamp. |
| `summary` | string | yes | Concise operator-readable completion summary. |
| `result` | object | yes | Structured outcome content. |
| `result.output_text` | string | no | Main textual output when applicable. |
| `result.artifacts` | array | no | Produced files, links, or references. |
| `result.metrics` | object | no | Runtime metrics Nanobot chooses to expose. |
| `worker_trace_ref` | string | no | Opaque Nanobot-side reference for deeper debugging. |

## Failure Payload

On terminal failure, Nanobot returns or posts a payload with at least:

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `dispatch_id` | string | yes | Must match the original dispatch. |
| `run_id` | string | yes | Must match the Paperclip run. |
| `status` | string | yes | Must be `failed` or `cancelled`. |
| `failed_at` | string | yes | ISO 8601 timestamp. |
| `error.code` | string | yes | Stable machine-readable category. |
| `error.message` | string | yes | Operator-readable explanation. |
| `error.retryable` | boolean | yes | Whether a new Paperclip dispatch could reasonably retry. |
| `error.details` | object | no | Additional structured diagnostics safe to persist. |
| `worker_trace_ref` | string | no | Opaque Nanobot-side reference for deeper debugging. |

## Correlation and Idempotency

- `dispatch_id` is the primary end-to-end correlation identifier.
- `run_id` ties the worker exchange back to Paperclip's canonical execution record.
- `idempotency_key` must remain stable for retried delivery of the same logical dispatch.
- Nanobot must not start duplicate worker runs for the same active `idempotency_key`.
- If Nanobot receives a duplicate dispatch after a terminal result already exists, it should return the known terminal status instead of re-executing work.

## Persistence Ownership

Paperclip persists:

- issue assignment and lifecycle
- approval decisions and budget state
- operator-visible audit history
- canonical dispatch record and terminal outcome attached to the issue or run
- any normalized summaries, outputs, or failure reasons needed for the dashboard

Nanobot persists:

- worker-local runtime state required to execute the dispatched run
- internal traces, tool activity, and provider-specific metadata
- ephemeral or implementation-specific execution details that do not replace Paperclip's audit record

Paperclip remains the system of record for cross-run orchestration history. Nanobot persistence supports execution, debugging, and internal recovery only.

## Testing Implications for Phase 2

Later implementation tests should be able to prove that:

1. Paperclip dispatches only after its approval and budget gates pass.
2. Nanobot accepts one logical run per `idempotency_key`.
3. Lifecycle updates correlate back to the same `dispatch_id` and `run_id`.
4. Success and failure payloads are sufficient for Paperclip to persist operator-visible results without reading Nanobot internals.
