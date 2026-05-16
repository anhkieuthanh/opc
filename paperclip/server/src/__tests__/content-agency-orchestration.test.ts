import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const companyId = "11111111-1111-4111-8111-111111111111";
const managerId = "22222222-2222-4222-8222-222222222222";
const researcherId = "33333333-3333-4333-8333-333333333333";
const writerId = "44444444-4444-4444-8444-444444444444";
const issueId = "55555555-5555-4555-8555-555555555555";

const mockWakeup = vi.hoisted(() => vi.fn(async () => undefined));
const mockAgentGetById = vi.hoisted(() => vi.fn());
const mockIssueGetById = vi.hoisted(() => vi.fn());
const mockIssueUpdate = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  accessService: () => ({
    canUser: vi.fn(async () => true),
    hasPermission: vi.fn(async () => true),
  }),
  agentInstructionsService: () => ({}),
  agentService: () => ({
    getById: mockAgentGetById,
    list: vi.fn(async () => []),
    orgForCompany: vi.fn(async () => []),
  }),
  approvalService: () => ({}),
  budgetService: () => ({ upsertPolicy: vi.fn(async () => undefined) }),
  companySearchService: () => ({}),
  companyService: () => ({
    getById: vi.fn(async () => ({ id: companyId, attachmentMaxBytes: 10 * 1024 * 1024 })),
  }),
  companySkillService: () => ({}),
  documentService: () => ({
    getIssueDocumentPayload: vi.fn(async () => ({})),
  }),
  executionWorkspaceService: () => ({
    getById: vi.fn(async () => null),
  }),
  feedbackService: () => ({}),
  getIssueContinuationSummaryDocument: vi.fn(async () => null),
  goalService: () => ({
    getById: vi.fn(async () => null),
    getDefaultCompanyGoal: vi.fn(async () => null),
  }),
  heartbeatService: () => ({
    wakeup: mockWakeup,
    reportRunActivity: vi.fn(async () => undefined),
  }),
  instanceSettingsService: () => ({
    get: vi.fn(async () => ({})),
    listCompanyIds: vi.fn(async () => []),
    getExperimental: vi.fn(async () => ({ enableIsolatedWorkspaces: false })),
  }),
  issueApprovalService: () => ({
    getActive: vi.fn(async () => null),
  }),
  issueReferenceService: () => ({
    deleteDocumentSource: async () => undefined,
    diffIssueReferenceSummary: () => ({
      addedReferencedIssues: [],
      removedReferencedIssues: [],
      currentReferencedIssues: [],
    }),
    emptySummary: () => ({ outbound: [], inbound: [] }),
    listIssueReferenceSummary: async () => ({ outbound: [], inbound: [] }),
    syncComment: async () => undefined,
    syncDocument: async () => undefined,
    syncIssue: async () => undefined,
  }),
  issueRecoveryActionService: () => ({
    getActiveForIssue: vi.fn(async () => null),
    listActiveForIssues: vi.fn(async () => new Map()),
  }),
  issueService: () => ({
    getById: mockIssueGetById,
    update: mockIssueUpdate,
    getAncestors: vi.fn(async () => []),
    getComment: vi.fn(async () => null),
    getCommentCursor: vi.fn(async () => ({ totalComments: 0, latestCommentId: null, latestCommentAt: null })),
    getRelationSummaries: vi.fn(async () => ({ blockedBy: [], blocks: [] })),
    listWakeableBlockedDependents: vi.fn(async () => []),
    getWakeableParentAfterChildCompletion: vi.fn(async () => null),
    findMentionedAgents: vi.fn(async () => []),
    getByIdentifier: vi.fn(async () => null),
  }),
  issueThreadInteractionService: () => ({}),
  logActivity: vi.fn(async () => undefined),
  projectService: () => ({
    getById: vi.fn(async () => null),
    listByIds: vi.fn(async () => []),
  }),
  routineService: () => ({
    syncRunStatusForIssue: vi.fn(async () => undefined),
    list: vi.fn(async () => []),
    get: vi.fn(async () => null),
    create: vi.fn(async () => null),
  }),
  syncInstructionsBundleConfigFromFilePath: vi.fn(async () => undefined),
  workProductService: () => ({
    listForIssue: vi.fn(async () => []),
  }),
  workspaceOperationService: () => ({}),
  clampIssueListLimit: (n: number) => n,
  ISSUE_LIST_DEFAULT_LIMIT: 50,
  ISSUE_LIST_MAX_LIMIT: 500,
}));

function boardActor(cids: string[] = [companyId]) {
  return { type: "board" as const, userId: "test-user", companyIds: cids, source: "local_implicit" as const, isInstanceAdmin: false };
}

async function createIssueApp() {
  const { issueRoutes } = await import("../routes/issues.js");
  const { errorHandler } = await import("../middleware/index.js");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = boardActor();
    next();
  });
  app.use("/api", issueRoutes({} as any, {} as any));
  app.use(errorHandler);
  return app;
}

async function createAgentApp() {
  const { agentRoutes } = await import("../routes/agents.js");
  const { errorHandler } = await import("../middleware/index.js");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = boardActor();
    next();
  });
  app.use("/api", agentRoutes({} as any));
  app.use(errorHandler);
  return app;
}

async function createRoutineApp() {
  const { routineRoutes } = await import("../routes/routines.js");
  const { errorHandler } = await import("../middleware/index.js");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = boardActor();
    next();
  });
  app.use("/api", routineRoutes({} as any));
  app.use(errorHandler);
  return app;
}

let issueApp: express.Express;
let agentApp: express.Express;
let routineApp: express.Express;

beforeEach(async () => {
  vi.clearAllMocks();
  if (!issueApp) issueApp = await createIssueApp();
  if (!agentApp) agentApp = await createAgentApp();
  if (!routineApp) routineApp = await createRoutineApp();
});

describe("Content Agency worker presets", () => {
  it("returns the three Content Agency worker presets", async () => {
    const res = await request(agentApp)
      .get(`/api/companies/${companyId}/content-agency/worker-presets`)
      .expect(200);

    const presets = res.body as Array<{
      key: string;
      role: string;
      adapterType: string;
      adapterConfig: { payloadTemplate: { role: string } };
    }>;
    expect(presets).toHaveLength(3);
    expect(presets.map((p) => p.key)).toEqual(["manager_editor", "researcher", "writer"]);
    expect(presets.every((p) => p.adapterType === "http")).toBe(true);
    expect(presets[0].role).toBe("pm");
    expect(presets[1].role).toBe("researcher");
    expect(presets[2].role).toBe("writer");
  });

  it("preset payloadTemplates carry the correct nanobot role field", async () => {
    const res = await request(agentApp)
      .get(`/api/companies/${companyId}/content-agency/worker-presets`)
      .expect(200);

    const presets = res.body as Array<{
      key: string;
      adapterConfig: { payloadTemplate: { role: string } };
    }>;
    const byKey = Object.fromEntries(presets.map((p) => [p.key, p]));
    expect(byKey.manager_editor.adapterConfig.payloadTemplate.role).toBe("manager_editor");
    expect(byKey.researcher.adapterConfig.payloadTemplate.role).toBe("researcher");
    expect(byKey.writer.adapterConfig.payloadTemplate.role).toBe("writer");
  });
});

describe("Content Agency workflow scaffold", () => {
  it("returns a scaffold with the correct role chain", async () => {
    const res = await request(routineApp)
      .get(`/api/companies/${companyId}/content-agency/workflow-scaffold`)
      .expect(200);

    expect(res.body.chain).toEqual(["pm", "researcher", "writer"]);
    expect(res.body.routineTemplate).toBeDefined();
    expect(res.body.routineTemplate.title).toContain("Content Agency");
    expect(res.body.handoffNote).toContain("handoff");
  });
});

describe("Content Agency role-chain handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("advances a researcher issue to the writer when next assignee has writer role", async () => {
    mockIssueGetById.mockResolvedValue({
      id: issueId,
      companyId,
      identifier: "CA-1",
      title: "Research: Topic X",
      description: null,
      status: "todo",
      priority: "medium",
      parentId: null,
      assigneeAgentId: researcherId,
      assigneeUserId: null,
      createdByAgentId: null,
      createdByUserId: null,
      executionWorkspaceId: null,
      labels: [],
      labelIds: [],
    });

    mockAgentGetById
      .mockResolvedValueOnce({
        id: researcherId,
        companyId,
        name: "Content Researcher",
        role: "researcher",
        adapterType: "http",
        adapterConfig: {},
        status: "idle",
      })
      .mockResolvedValueOnce({
        id: writerId,
        companyId,
        name: "Content Writer",
        role: "writer",
        adapterType: "http",
        adapterConfig: {},
        status: "idle",
      });

    mockIssueUpdate.mockResolvedValue({
      id: issueId,
      companyId,
      assigneeAgentId: writerId,
      status: "todo",
    });

    const res = await request(issueApp)
      .post(`/api/companies/${companyId}/issues/${issueId}/content-agency/handoff`)
      .send({ nextAssigneeAgentId: writerId })
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.nextRole).toBe("writer");
    expect(res.body.nextAssigneeAgentId).toBe(writerId);
    expect(mockWakeup).toHaveBeenCalled();
  });

  it("rejects handoff when current assignee role is not in the Content Agency chain", async () => {
    mockIssueGetById.mockResolvedValue({
      id: issueId,
      companyId,
      identifier: "CA-2",
      title: "Engineering issue",
      description: null,
      status: "todo",
      priority: "medium",
      parentId: null,
      assigneeAgentId: "eng-agent",
      assigneeUserId: null,
      createdByAgentId: null,
      createdByUserId: null,
      executionWorkspaceId: null,
      labels: [],
      labelIds: [],
    });

    mockAgentGetById.mockResolvedValue({
      id: "eng-agent",
      companyId,
      name: "Engineer",
      role: "engineer",
      adapterType: "http",
      adapterConfig: {},
      status: "idle",
    });

    const res = await request(issueApp)
      .post(`/api/companies/${companyId}/issues/${issueId}/content-agency/handoff`)
      .send({ nextAssigneeAgentId: writerId })
      .expect(422);

    expect(res.body.error).toMatch(/no next role/i);
  });

  it("rejects handoff when next agent role does not match expected chain position", async () => {
    mockIssueGetById.mockResolvedValue({
      id: issueId,
      companyId,
      identifier: "CA-3",
      title: "Research issue",
      description: null,
      status: "todo",
      priority: "medium",
      parentId: null,
      assigneeAgentId: researcherId,
      assigneeUserId: null,
      createdByAgentId: null,
      createdByUserId: null,
      executionWorkspaceId: null,
      labels: [],
      labelIds: [],
    });

    mockAgentGetById
      .mockResolvedValueOnce({
        id: researcherId,
        companyId,
        name: "Content Researcher",
        role: "researcher",
        adapterType: "http",
        adapterConfig: {},
        status: "idle",
      })
      .mockResolvedValueOnce({
        id: managerId,
        companyId,
        name: "Content Manager",
        role: "pm",
        adapterType: "http",
        adapterConfig: {},
        status: "idle",
      });

    const res = await request(issueApp)
      .post(`/api/companies/${companyId}/issues/${issueId}/content-agency/handoff`)
      .send({ nextAssigneeAgentId: managerId })
      .expect(422);

    expect(res.body.error).toMatch(/expected next agent/i);
  });

  it("rejects handoff when issue has no current assignee", async () => {
    mockIssueGetById.mockResolvedValue({
      id: issueId,
      companyId,
      identifier: "CA-4",
      title: "Unassigned issue",
      description: null,
      status: "todo",
      priority: "medium",
      parentId: null,
      assigneeAgentId: null,
      assigneeUserId: null,
      createdByAgentId: null,
      createdByUserId: null,
      executionWorkspaceId: null,
      labels: [],
      labelIds: [],
    });

    const res = await request(issueApp)
      .post(`/api/companies/${companyId}/issues/${issueId}/content-agency/handoff`)
      .send({ nextAssigneeAgentId: writerId })
      .expect(422);

    expect(res.body.error).toMatch(/current assignee/i);
  });
});

describe("resolveNextContentAgencyRole", () => {
  it("maps pm -> researcher -> writer and terminal writer to null", async () => {
    const { resolveNextContentAgencyRole } = await import("../services/issue-assignment-wakeup.js");
    expect(resolveNextContentAgencyRole("pm")).toBe("researcher");
    expect(resolveNextContentAgencyRole("researcher")).toBe("writer");
    expect(resolveNextContentAgencyRole("writer")).toBeNull();
    expect(resolveNextContentAgencyRole("engineer")).toBeNull();
  });
});
