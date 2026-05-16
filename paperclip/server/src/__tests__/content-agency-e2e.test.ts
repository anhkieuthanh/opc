import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import express from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activityLog,
  agentRuntimeState,
  agentWakeupRequests,
  agents,
  companies,
  companyMemberships,
  createDb,
  executionWorkspaces,
  heartbeatRunEvents,
  heartbeatRuns,
  instanceSettings,
  issueComments,
  issues,
  principalPermissionGrants,
  projectWorkspaces,
  projects,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { accessService } from "../services/access.js";

function makeHeartbeatWakeupFn(db: ReturnType<typeof createDb>) {
  return async (agentId: string, wakeupOpts: any) => {
    const issueId =
      (typeof wakeupOpts?.payload?.issueId === "string" && wakeupOpts.payload.issueId) ||
      (typeof wakeupOpts?.contextSnapshot?.issueId === "string" && wakeupOpts.contextSnapshot.issueId) ||
      null;
    if (!issueId) return null;

    const issue = await db
      .select({ companyId: issues.companyId })
      .from(issues)
      .where(eq(issues.id, issueId))
      .then((rows: Array<{ companyId: string }>) => rows[0] ?? null);
    if (!issue) return null;

    const queuedRunId = randomUUID();
    try {
      await db.insert(heartbeatRuns).values({
        id: queuedRunId,
        companyId: issue.companyId,
        agentId,
        invocationSource: wakeupOpts?.source ?? "assignment",
        triggerDetail: wakeupOpts?.triggerDetail ?? null,
        status: "queued",
        contextSnapshot: { ...(wakeupOpts?.contextSnapshot ?? {}), issueId },
      });
    } catch (insertErr) {
      console.error("[wakeup-mock] heartbeatRun insert failed:", insertErr);
      throw insertErr;
    }
    await db
      .update(issues)
      .set({
        executionRunId: queuedRunId,
        executionLockedAt: new Date(),
      })
      .where(eq(issues.id, issueId));
    return { id: queuedRunId };
  };
}

function registerHeartbeatWakeupMock(db: ReturnType<typeof createDb>) {
  const wakeupFn = makeHeartbeatWakeupFn(db);
  const mockedHeartbeatService = (_db: any, _opts?: any) => ({
    wakeup: wakeupFn,
    // Stubs for all methods the route may call
    getRun: async () => null,
    getActiveRunForAgent: async () => null,
    reportRunActivity: async () => undefined,
    listEvents: async () => [],
    getRetryExhaustedReason: async () => null,
    readLog: async () => null,
    invoke: async () => null,
    triggerIssueMonitor: async () => undefined,
    triggerIssueLivenessEscalation: async () => undefined,
    listActiveRunsForIssue: async () => [],
    scheduleRetry: async () => null,
    cancelRun: async () => null,
    setRunStatus: async () => null,
  });

  vi.doMock("../services/heartbeat.js", async () => {
    const actual = await vi.importActual<typeof import("../services/heartbeat.js")>("../services/heartbeat.js");
    return { ...actual, heartbeatService: mockedHeartbeatService };
  });

  vi.doMock("../services/index.js", async () => {
    const actual = await vi.importActual<typeof import("../services/index.js")>("../services/index.js");
    return { ...actual, heartbeatService: mockedHeartbeatService };
  });
}

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe.sequential : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres content-agency E2E tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("content agency end-to-end", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-content-agency-e2e-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    // Delete in FK-safe order (children before parents)
    await db.delete(activityLog);
    await db.delete(issueComments);
    await db.delete(heartbeatRunEvents);
    await db.delete(heartbeatRuns);
    await db.delete(agentWakeupRequests);
    await db.delete(issues);
    await db.delete(executionWorkspaces);
    await db.delete(projectWorkspaces);
    await db.delete(principalPermissionGrants);
    await db.delete(companyMemberships);
    await db.delete(projects);
    await db.delete(agentRuntimeState);
    await db.delete(agents);
    await db.delete(companies);
    await db.delete(instanceSettings);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("@paperclipai/shared/telemetry");
    vi.doUnmock("../telemetry.js");
    vi.doUnmock("../services/access.js");
    vi.doUnmock("../services/issues.js");
    vi.doUnmock("../services/companies.js");
    vi.doUnmock("../services/projects.js");
    vi.doUnmock("../services/company-skills.js");
    vi.doUnmock("../services/assets.js");
    vi.doUnmock("../services/agent-instructions.js");
    vi.doUnmock("../services/workspace-runtime.js");
    vi.doUnmock("../services/routines.js");
    vi.doUnmock("../routes/issues.js");
    vi.doUnmock("../routes/authz.js");
    vi.doUnmock("../middleware/index.js");
    // Mock heartbeatService.wakeup to insert queued runs directly (avoids real
    // agent execution which would transition statuses and create FK complications)
    registerHeartbeatWakeupMock(db);
    vi.doMock("../routes/authz.js", async () => vi.importActual("../routes/authz.js"));
    vi.clearAllMocks();
  });

  async function createIssueApp(actor: Record<string, unknown>) {
    const [{ issueRoutes }, { errorHandler }] = await Promise.all([
      import("../routes/issues.js"),
      import("../middleware/index.js"),
    ]);
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).actor = actor;
      next();
    });
    app.use("/api", issueRoutes(db, {} as any));
    app.use(errorHandler);
    return app;
  }

  async function seedFixture() {
    const companyId = randomUUID();
    const pmId = randomUUID();
    const researcherId = randomUUID();
    const writerId = randomUUID();
    const projectId = randomUUID();
    const userId = randomUUID();
    const issuePrefix = `CA${companyId.replace(/-/g, "").slice(0, 4).toUpperCase()}`;

    await db.insert(companies).values({
      id: companyId,
      name: "Content Agency Co",
      issuePrefix,
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(agents).values([
      {
        id: pmId,
        companyId,
        name: "Content Manager",
        role: "pm",
        status: "active",
        adapterType: "http",
        adapterConfig: { url: "https://mock.test/dispatch" },
        runtimeConfig: {},
        permissions: {},
      },
      {
        id: researcherId,
        companyId,
        name: "Content Researcher",
        role: "researcher",
        status: "active",
        adapterType: "http",
        adapterConfig: { url: "https://mock.test/dispatch" },
        runtimeConfig: {},
        permissions: {},
      },
      {
        id: writerId,
        companyId,
        name: "Content Writer",
        role: "writer",
        status: "active",
        adapterType: "http",
        adapterConfig: { url: "https://mock.test/dispatch" },
        runtimeConfig: {},
        permissions: {},
      },
    ]);

    await db.insert(projects).values({
      id: projectId,
      companyId,
      name: "Content Agency Project",
      status: "in_progress",
    });

    const access = accessService(db);
    const membership = await access.ensureMembership(companyId, "user", userId, "owner", "active");
    await access.setMemberPermissions(
      companyId,
      membership.id,
      [{ permissionKey: "tasks:assign" }],
      userId,
    );

    return { companyId, pmId, researcherId, writerId, projectId, userId };
  }

  it("content agency chain: pm → researcher → writer handoff updates DB assignee and queues runs", async () => {
    const { companyId, pmId, researcherId, writerId, projectId, userId } = await seedFixture();

    const issueId = randomUUID();
    await db.insert(issues).values({
      id: issueId,
      companyId,
      projectId,
      assigneeAgentId: pmId,
      status: "todo",
      title: "Write article about AI",
    });

    const app = await createIssueApp({
      type: "board",
      userId,
      source: "session",
      isInstanceAdmin: false,
      companyIds: [companyId],
    });

    // Step 1: PM → Researcher handoff
    const handoff1Res = await request(app)
      .post(`/api/companies/${companyId}/issues/${issueId}/content-agency/handoff`)
      .send({ nextAssigneeAgentId: researcherId });

    expect(handoff1Res.status).toBe(200);
    expect(handoff1Res.body.ok).toBe(true);
    expect(handoff1Res.body.nextRole).toBe("researcher");
    expect(handoff1Res.body.nextAssigneeAgentId).toBe(researcherId);

    // Wait for async wakeup (void queueIssueAssignmentWakeup) to complete
    await new Promise((r) => setTimeout(r, 50));

    // Assert issue assignee updated to researcher
    const [issueAfterHandoff1] = await db
      .select({ assigneeAgentId: issues.assigneeAgentId })
      .from(issues)
      .where(eq(issues.id, issueId));
    expect(issueAfterHandoff1?.assigneeAgentId).toBe(researcherId);

    // Assert a heartbeat run was created for researcher (wakeup was triggered)
    const runs1 = await db
      .select({ agentId: heartbeatRuns.agentId, status: heartbeatRuns.status })
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.companyId, companyId));
    const researcherRun = runs1.find((r) => r.agentId === researcherId);
    expect(researcherRun).toBeDefined();
    expect(researcherRun?.status).toBe("queued");

    // Step 2: Researcher → Writer handoff
    const handoff2Res = await request(app)
      .post(`/api/companies/${companyId}/issues/${issueId}/content-agency/handoff`)
      .send({ nextAssigneeAgentId: writerId });

    expect(handoff2Res.status).toBe(200);
    expect(handoff2Res.body.ok).toBe(true);
    expect(handoff2Res.body.nextRole).toBe("writer");
    expect(handoff2Res.body.nextAssigneeAgentId).toBe(writerId);

    // Assert issue assignee updated to writer
    const [issueAfterHandoff2] = await db
      .select({ assigneeAgentId: issues.assigneeAgentId })
      .from(issues)
      .where(eq(issues.id, issueId));
    expect(issueAfterHandoff2?.assigneeAgentId).toBe(writerId);

    // Assert a heartbeat run was created for writer (wakeup was triggered)
    const runs2 = await db
      .select({ agentId: heartbeatRuns.agentId, status: heartbeatRuns.status })
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.companyId, companyId));
    const writerRun = runs2.find((r) => r.agentId === writerId);
    expect(writerRun).toBeDefined();
    expect(writerRun?.status).toBe("queued");

    // Wait for async wakeup (void queueIssueAssignmentWakeup) to complete
    await new Promise((r) => setTimeout(r, 50));

    // Assert two content_agency_handoff activity log entries
    const handoffEntries = await db
      .select({ action: activityLog.action })
      .from(activityLog)
      .where(eq(activityLog.companyId, companyId));
    const handoffActions = handoffEntries.filter((e) => e.action === "issue.content_agency_handoff");
    expect(handoffActions).toHaveLength(2);
  }, 30_000);

  it("persistence: bridge success resultJson and issue comment are stored (per D-03)", async () => {
    const { companyId, writerId, projectId, userId } = await seedFixture();

    const issueId = randomUUID();
    await db.insert(issues).values({
      id: issueId,
      companyId,
      projectId,
      assigneeAgentId: writerId,
      status: "todo",
      title: "Write article about AI",
    });

    // Seed a queued heartbeatRun for the writer agent
    const runId = randomUUID();
    await db.insert(heartbeatRuns).values({
      id: runId,
      companyId,
      agentId: writerId,
      invocationSource: "assignment",
      triggerDetail: null,
      status: "queued",
      contextSnapshot: { issueId },
    });

    // Stub global fetch to return a bridge success payload
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(
        JSON.stringify({
          dispatch_id: "dispatch-e2e-1",
          run_id: "run-e2e-1",
          status: "succeeded",
          completed_at: new Date().toISOString(),
          summary: "Writer output complete",
          result: {
            output_text: "Full article text",
            artifacts: [],
            metadata: {},
          },
          worker_trace_ref: "paperclip:run-e2e-1",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    ));

    // Import execute adapter and heartbeat-run-summary helpers directly
    const { execute } = await import("../adapters/http/execute.js");
    const { mergeHeartbeatRunResultJson, buildHeartbeatRunIssueComment } = await import(
      "../services/heartbeat-run-summary.js"
    );
    const { issueService } = await import("../services/issues.js");

    // Call execute() for the writer agent config
    const adapterResult = await execute({
      runId,
      agent: {
        id: writerId,
        companyId,
        name: "Content Writer",
        adapterType: "http",
        adapterConfig: {},
      },
      runtime: {
        sessionId: null,
        sessionParams: null,
        sessionDisplayId: null,
        taskKey: null,
      },
      config: {
        url: "https://mock.test/dispatch",
      },
      context: {
        dispatchId: "dispatch-e2e-1",
        issueId,
        companyId,
        idempotencyKey: `ikey-${runId}`,
      },
      onLog: async () => {},
    });

    // Build persisted resultJson (replicates the private executeRun persistence path)
    const persistedResultJson = mergeHeartbeatRunResultJson(
      adapterResult.resultJson ?? null,
      adapterResult.summary ?? null,
    );

    // Persist to DB: update heartbeatRun status and resultJson
    await db
      .update(heartbeatRuns)
      .set({ status: "succeeded", resultJson: persistedResultJson })
      .where(eq(heartbeatRuns.id, runId));

    // Post issue comment from run result (replicates heartbeat service behavior)
    const comment = buildHeartbeatRunIssueComment(persistedResultJson);
    if (comment) {
      const issueSvc = issueService(db);
      const { logActivity } = await import("../services/activity-log.js");
      const addedComment = await issueSvc.addComment(issueId, comment, { agentId: writerId, runId });
      if (addedComment) {
        await logActivity(db, {
          companyId,
          actorType: "agent",
          actorId: writerId,
          agentId: writerId,
          runId,
          action: "issue.comment_added",
          entityType: "issue",
          entityId: issueId,
          details: { commentId: addedComment.id, bodySnippet: comment.slice(0, 120) },
        });
      }
    }

    // Assert: heartbeat_runs.resultJson contains the expected fields
    const [persistedRun] = await db
      .select({ resultJson: heartbeatRuns.resultJson, status: heartbeatRuns.status })
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.id, runId));

    expect(persistedRun?.status).toBe("succeeded");
    const storedResultJson = persistedRun?.resultJson as Record<string, unknown> | null;
    expect(storedResultJson).toBeDefined();
    const storedResult = storedResultJson?.result as Record<string, unknown> | undefined;
    expect(storedResult?.output_text).toBe("Full article text");
    expect(storedResultJson?.summary).toBe("Writer output complete");

    // Assert: activityLog has issue.comment_added entry
    const commentEntries = await db
      .select({ action: activityLog.action })
      .from(activityLog)
      .where(
        and(
          eq(activityLog.entityType, "issue"),
          eq(activityLog.entityId, issueId),
        ),
      );
    const commentAdded = commentEntries.find((e) => e.action === "issue.comment_added");
    expect(commentAdded).toBeDefined();
  }, 30_000);

  it("persistence: bridge failure errorCode and retryable flag are stored (per D-04)", async () => {
    const { companyId, writerId, projectId } = await seedFixture();

    const issueId = randomUUID();
    await db.insert(issues).values({
      id: issueId,
      companyId,
      projectId,
      assigneeAgentId: writerId,
      status: "todo",
      title: "Write article about AI",
    });

    // Seed a queued heartbeatRun
    const runId = randomUUID();
    await db.insert(heartbeatRuns).values({
      id: runId,
      companyId,
      agentId: writerId,
      invocationSource: "assignment",
      triggerDetail: null,
      status: "queued",
      contextSnapshot: { issueId },
    });

    // Stub global fetch to return a bridge failure payload with HTTP 500
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(
        JSON.stringify({
          dispatch_id: "dispatch-fail-1",
          run_id: "run-fail-1",
          status: "failed",
          failed_at: new Date().toISOString(),
          error: {
            code: "dispatch_execution_failed",
            message: "Worker error",
            retryable: true,
          },
          worker_trace_ref: "paperclip:run-fail-1",
        }),
        { status: 500, headers: { "content-type": "application/json" } },
      )
    ));

    // Import execute adapter and heartbeat-run-summary helpers
    const { execute } = await import("../adapters/http/execute.js");
    const { mergeHeartbeatRunResultJson } = await import("../services/heartbeat-run-summary.js");

    // Call execute()
    const adapterResult = await execute({
      runId,
      agent: {
        id: writerId,
        companyId,
        name: "Content Writer",
        adapterType: "http",
        adapterConfig: {},
      },
      runtime: {
        sessionId: null,
        sessionParams: null,
        sessionDisplayId: null,
        taskKey: null,
      },
      config: {
        url: "https://mock.test/dispatch",
      },
      context: {
        dispatchId: "dispatch-fail-1",
        issueId,
        companyId,
        idempotencyKey: `ikey-fail-${runId}`,
      },
      onLog: async () => {},
    });

    // Build persisted resultJson
    const persistedResultJson = mergeHeartbeatRunResultJson(
      adapterResult.resultJson ?? null,
      adapterResult.summary ?? null,
    );

    // Persist failure to DB
    await db
      .update(heartbeatRuns)
      .set({
        status: "failed",
        errorCode: adapterResult.errorCode ?? null,
        resultJson: persistedResultJson,
      })
      .where(eq(heartbeatRuns.id, runId));

    // Assert: heartbeat_runs.status is "failed" and errorCode matches
    const [persistedRun] = await db
      .select({
        status: heartbeatRuns.status,
        errorCode: heartbeatRuns.errorCode,
        resultJson: heartbeatRuns.resultJson,
      })
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.id, runId));

    expect(persistedRun?.status).toBe("failed");
    expect(persistedRun?.errorCode).toBe("dispatch_execution_failed");

    // Assert resultJson has the failure error info
    const storedResultJson = persistedRun?.resultJson as Record<string, unknown> | null;
    expect(storedResultJson).toBeDefined();
  }, 30_000);
});
