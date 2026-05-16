import { afterEach, describe, expect, it, vi } from "vitest";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: Record<string, unknown>, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
    ...init,
  });
}

describe("http adapter execute", () => {
  it("sends bridge correlation fields and maps structured success responses", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      return jsonResponse({
        dispatch_id: "dispatch-ctx",
        run_id: "run-1",
        status: "succeeded",
        summary: "Bridge completed",
        result: {
          output_text: "Completed artifact generation",
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await execute({
      runId: "run-1",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "Agent",
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
        url: "https://example.test/bridge/dispatch",
        headers: {
          authorization: "Bearer bridge-secret",
        },
        payloadTemplate: {
          role: "writer",
          dispatch_id: "dispatch-template",
        },
      },
      context: {
        dispatchId: "dispatch-ctx",
        issueId: "issue-1",
        companyId: "company-1",
      },
      onLog: async () => {},
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [_url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "content-type": "application/json",
      authorization: "Bearer bridge-secret",
    });

    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      agentId: "agent-1",
      runId: "run-1",
      run_id: "run-1",
      dispatch_id: "dispatch-ctx",
      dispatchId: "dispatch-ctx",
      issue_id: "issue-1",
      issueId: "issue-1",
      company_id: "company-1",
      companyId: "company-1",
      role: "writer",
    });
    expect(body.context).toMatchObject({
      dispatchId: "dispatch-ctx",
      issueId: "issue-1",
      companyId: "company-1",
    });

    expect(result).toMatchObject({
      exitCode: 0,
      timedOut: false,
      summary: "Bridge completed",
    });
    expect(result.resultJson).toMatchObject({
      dispatch_id: "dispatch-ctx",
      run_id: "run-1",
      status: "succeeded",
    });
  });

  it("maps structured non-2xx bridge errors into adapter results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({
        dispatch_id: "dispatch-err",
        run_id: "run-1",
        status: "failed",
        error: {
          code: "bridge_invalid_payload",
          message: "Missing issue_id",
          retryable: false,
          details: {
            field: "issue_id",
          },
        },
      }, { status: 422 })),
    );

    const result = await execute({
      runId: "run-1",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "Agent",
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
        url: "https://example.test/bridge/dispatch",
      },
      context: {},
      onLog: async () => {},
    });

    expect(result).toMatchObject({
      exitCode: 422,
      timedOut: false,
      errorCode: "bridge_invalid_payload",
      errorMessage: "Missing issue_id",
      summary: "Missing issue_id",
    });
    expect(result.errorMeta).toMatchObject({
      retryable: false,
      details: {
        field: "issue_id",
      },
      status: 422,
    });
    expect(result.resultJson).toMatchObject({
      dispatch_id: "dispatch-err",
      run_id: "run-1",
      status: "failed",
    });
  });

  it("reports configured request timeout as timed_out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      })),
    );

    const result = await execute({
      runId: "run-1",
      agent: {
        id: "agent-1",
        companyId: "company-1",
        name: "Agent",
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
        url: "https://example.test/webhook",
        timeoutMs: 1,
      },
      context: {},
      onLog: async () => {},
    });

    expect(result.timedOut).toBe(true);
    expect(result.errorCode).toBe("timeout");
    expect(result.errorMessage).toContain("timed out after 1ms");
  });
});

describe("content agency http adapter dispatch", () => {
  it("sends role field from payloadTemplate for each Content Agency role", async () => {
    const roles = ["manager_editor", "researcher", "writer"] as const;

    for (const role of roles) {
      const fetchMock = vi.fn(async () =>
        new Response(JSON.stringify({ status: "accepted", summary: `${role} dispatched` }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      await execute({
        runId: `run-${role}`,
        agent: {
          id: `agent-${role}`,
          companyId: "company-1",
          name: `Content ${role}`,
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
          url: "https://nanobot.test/paperclip/dispatch",
          headers: { authorization: "Bearer bridge-token" },
          payloadTemplate: { role },
        },
        context: {
          issueId: `issue-${role}`,
          companyId: "company-1",
        },
        onLog: async () => {},
      });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      expect(body.role).toBe(role);
      expect(body.issue_id).toBe(`issue-${role}`);

      vi.unstubAllGlobals();
    }
  });

  it("bridge payload includes all required correlation fields", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ status: "succeeded", summary: "Done" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await execute({
      runId: "run-bridge-1",
      agent: {
        id: "agent-researcher",
        companyId: "company-ca",
        name: "Content Researcher",
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
        url: "https://nanobot.test/paperclip/dispatch",
        payloadTemplate: { role: "researcher" },
      },
      context: {
        dispatchId: "dispatch-abc",
        issueId: "issue-abc",
        companyId: "company-ca",
        idempotencyKey: "ikey-abc",
      },
      onLog: async () => {},
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(body).toMatchObject({
      role: "researcher",
      agentId: "agent-researcher",
      runId: "run-bridge-1",
      run_id: "run-bridge-1",
      dispatch_id: "dispatch-abc",
      dispatchId: "dispatch-abc",
      issue_id: "issue-abc",
      issueId: "issue-abc",
      company_id: "company-ca",
      companyId: "company-ca",
      idempotency_key: "ikey-abc",
      idempotencyKey: "ikey-abc",
    });
  });
});

describe("http adapter testEnvironment", () => {
  it("probes configured healthUrl with GET for bridge endpoints", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await testEnvironment({
      companyId: "company-1",
      adapterType: "http",
      config: {
        url: "https://example.test/bridge/dispatch",
        method: "POST",
        healthUrl: "https://example.test/health",
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://example.test/health"),
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(result.status).toBe("pass");
    expect(result.checks).toContainEqual(expect.objectContaining({
      code: "http_endpoint_probe_ok",
    }));
  });
});
