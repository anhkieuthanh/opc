# Content Agency Smoke Test Runbook

## Purpose

This is the v1 manual smoke-test path for verifying the Content Agency workflow end to end.
It complements the automated tests and lets an operator confirm the system is healthy
without reading source code.

Automated coverage: `content-agency-e2e.test.ts` (embedded-Postgres chain),
`execute.test.ts` (bridge contract assertions), `test_paperclip_bridge.py` (Nanobot dispatch).

Reference: [docs/integration/paperclip-nanobot-bridge.md](../integration/paperclip-nanobot-bridge.md)

---

## Prerequisites

1. **Paperclip server** is running (e.g., `npm run dev` in `paperclip/`) on its configured port.
2. **Nanobot** is running in bridge mode: `nanobot serve-paperclip-bridge`.
3. **Environment variables** on both sides:
   - Paperclip: `NANOBOT_BRIDGE_URL` and `NANOBOT_BRIDGE_TOKEN`
   - Nanobot: `PAPERCLIP_BRIDGE_TOKEN` (must match `NANOBOT_BRIDGE_TOKEN`)
4. **Three Content Agency agents** exist in the company (`role: pm`, `researcher`, `writer`),
   each with `adapterType: http` pointing at the Nanobot bridge URL.
   Use `GET /api/companies/:companyId/content-agency/worker-presets` for preset configs.
5. **A Paperclip user** with `tasks:assign` permission in the company.

---

## Step-by-Step Smoke Test

Replace `:companyId`, `:issueId`, `:managerId`, `:researcherId`, `:writerId`, and `BASE_URL`
(e.g., `http://localhost:3000/api`) with values from your environment.

**1. Create an issue and assign it to the Manager/Editor (pm) agent:**
```bash
curl -X POST "BASE_URL/companies/:companyId/issues" \
  -H "Content-Type: application/json" \
  -d '{"title": "Write article about AI", "assigneeAgentId": ":managerId", "projectId": ":projectId"}'
```
Record the returned `id` as `:issueId`.

**2. Verify the issue appears in the Manager's queue:**
```bash
curl "BASE_URL/companies/:companyId/issues?assigneeAgentId=:managerId"
```
Expected: issue appears with `assigneeAgentId: ":managerId"`.

**3. Trigger researcher handoff:**
```bash
curl -X POST "BASE_URL/companies/:companyId/issues/:issueId/content-agency/handoff" \
  -H "Content-Type: application/json" -d '{"nextAssigneeAgentId": ":researcherId"}'
```
Expected: `{"ok": true, "nextRole": "researcher", "nextAssigneeAgentId": ":researcherId"}`

**4. Verify issue assignee updated to researcher:**
```bash
curl "BASE_URL/companies/:companyId/issues/:issueId"
```
Expected: `assigneeAgentId` equals `:researcherId`.

**5. Verify a heartbeat run was queued for the researcher:**
```bash
curl "BASE_URL/companies/:companyId/issues/:issueId/runs"
```
Expected: a run with `status: "queued"` (or `"running"`) for `:researcherId`.

**6. Wait for researcher run to complete:**
Poll `GET /companies/:companyId/issues/:issueId/runs` until the researcher run is `"succeeded"`.
If it shows `"failed"`, see Failure Triage below.

**7. Verify researcher output comment:**
```bash
curl "BASE_URL/companies/:companyId/issues/:issueId/activity"
```
Expected: activity log contains `action: "issue.comment_added"` with the researcher's summary.

**8. Trigger writer handoff:**
```bash
curl -X POST "BASE_URL/companies/:companyId/issues/:issueId/content-agency/handoff" \
  -H "Content-Type: application/json" -d '{"nextAssigneeAgentId": ":writerId"}'
```
Expected: `{"ok": true, "nextRole": "writer", "nextAssigneeAgentId": ":writerId"}`

**9. Wait for writer run to complete:**
Poll `GET /companies/:companyId/issues/:issueId/runs` until the writer run is `"succeeded"`.

**10. Verify writer output comment:**
```bash
curl "BASE_URL/companies/:companyId/issues/:issueId/activity"
```
Expected: a second `action: "issue.comment_added"` entry with the writer's output text.

---

## Expected Outcome

A fully successful run shows:
- Two `issue.comment_added` entries in the activity log (researcher + writer).
- Two runs with `status: "succeeded"` for `:researcherId` and `:writerId`.
- Issue `assigneeAgentId` is `:writerId` in the final state.
- No `"failed"` runs.

---

## Failure Triage

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| Handoff 422 "No next role" | Agent's `role` is not in the Content Agency chain | Fix the agent's role (pm → researcher → writer) |
| Handoff 422 "Expected next agent to have role" | Wrong chain position for `nextAssigneeAgentId` | Check role ordering: pm → researcher → writer |
| Run stuck at `"queued"` | Nanobot bridge not running or URL/token misconfigured | Verify `NANOBOT_BRIDGE_URL` and `NANOBOT_BRIDGE_TOKEN` on Paperclip; `PAPERCLIP_BRIDGE_TOKEN` on Nanobot |
| Run failed with `errorCode: "bridge_auth_failed"` | Token mismatch between Paperclip and Nanobot | Ensure `NANOBOT_BRIDGE_TOKEN` (Paperclip) == `PAPERCLIP_BRIDGE_TOKEN` (Nanobot) |
| Run failed with `errorCode: "dispatch_execution_failed"` + `retryable: true` | Nanobot worker runtime error | Re-trigger by re-assigning or posting handoff again; check Nanobot logs |

---

## Related Resources

- [Bridge contract](../integration/paperclip-nanobot-bridge.md) — payload schema and lifecycle
- `GET /api/companies/:companyId/content-agency/workflow-scaffold` — chain description and handoff instructions
- `GET /api/companies/:companyId/content-agency/worker-presets` — preset agent configurations
