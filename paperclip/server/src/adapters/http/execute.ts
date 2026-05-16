import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { asString, asNumber, parseObject } from "../utils.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toStringRecord(value: unknown): Record<string, string> {
  const parsed = parseObject(value);
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(parsed)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

function firstNonEmpty(...values: unknown[]): string | null {
  for (const value of values) {
    const normalized = nonEmpty(value);
    if (normalized) return normalized;
  }
  return null;
}

function setIfPresent(target: Record<string, unknown>, entries: Array<[string, unknown]>): void {
  for (const [key, value] of entries) {
    if (value !== null && value !== undefined) {
      target[key] = value;
    }
  }
}

function parseResponseBody(raw: string, contentType: string | null): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const expectsJson =
    (contentType ?? "").toLowerCase().includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[");
  if (!expectsJson) return trimmed;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function extractSummary(payload: Record<string, unknown>): string | null {
  const result = asRecord(payload.result);
  return (
    firstNonEmpty(
      payload.summary,
      result?.summary,
      result?.output_text,
      result?.outputText,
      payload.message,
    ) ?? null
  );
}

function mapJsonResponse(input: {
  payload: Record<string, unknown>;
  status: number;
  ok: boolean;
  defaultSummary: string;
}): AdapterExecutionResult {
  const { payload, status, ok, defaultSummary } = input;
  const error = asRecord(payload.error);
  const statusText = nonEmpty(payload.status)?.toLowerCase() ?? "";
  const timedOut = payload.timedOut === true || payload.timed_out === true || statusText === "timeout";
  const summary = extractSummary(payload);
  const errorMessage =
    firstNonEmpty(
      error?.message,
      payload.errorMessage,
      payload.error_message,
      !ok || statusText === "failed" || statusText === "cancelled" || statusText === "error" || timedOut
        ? summary
        : null,
    ) ?? null;
  const errorCode =
    firstNonEmpty(
      error?.code,
      payload.errorCode,
      payload.error_code,
      timedOut ? "timeout" : null,
    ) ?? null;
  const retryNotBefore =
    firstNonEmpty(
      error?.retryNotBefore,
      error?.retry_not_before,
      payload.retryNotBefore,
      payload.retry_not_before,
    ) ?? null;
  const errorFamily =
    firstNonEmpty(error?.errorFamily, error?.error_family, payload.errorFamily, payload.error_family) ?? null;
  const errorDetails = asRecord(error?.details) ?? asRecord(payload.errorMeta) ?? undefined;
  const errorMeta =
    !ok || errorMessage || errorCode || timedOut
      ? {
          ...(typeof error?.retryable === "boolean" ? { retryable: error.retryable } : {}),
          ...(errorDetails ? { details: errorDetails } : {}),
          status,
        }
      : undefined;
  const failed = !ok || timedOut || statusText === "failed" || statusText === "cancelled" || statusText === "error";

  return {
    exitCode: failed ? status : 0,
    signal: null,
    timedOut,
    ...(errorMessage ? { errorMessage } : {}),
    ...(errorCode ? { errorCode } : {}),
    ...(errorFamily ? { errorFamily: errorFamily as AdapterExecutionResult["errorFamily"] } : {}),
    ...(retryNotBefore ? { retryNotBefore } : {}),
    ...(errorMeta ? { errorMeta } : {}),
    resultJson: payload,
    summary: summary ?? errorMessage ?? defaultSummary,
  };
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, runId, agent, context } = ctx;
  const url = asString(config.url, "");
  if (!url) throw new Error("HTTP adapter missing url");

  const method = asString(config.method, "POST");
  const timeoutMs = asNumber(config.timeoutMs, 0);
  const headers = toStringRecord(config.headers);
  const payloadTemplate = parseObject(config.payloadTemplate);
  const contextRecord = parseObject(context);
  const dispatchId = firstNonEmpty(
    contextRecord.dispatchId,
    contextRecord.dispatch_id,
    payloadTemplate.dispatchId,
    payloadTemplate.dispatch_id,
  );
  const issueId = firstNonEmpty(
    contextRecord.issueId,
    contextRecord.issue_id,
    payloadTemplate.issueId,
    payloadTemplate.issue_id,
  );
  const taskId = firstNonEmpty(
    contextRecord.taskId,
    contextRecord.task_id,
    payloadTemplate.taskId,
    payloadTemplate.task_id,
  );
  const companyId = firstNonEmpty(
    contextRecord.companyId,
    contextRecord.company_id,
    payloadTemplate.companyId,
    payloadTemplate.company_id,
    agent.companyId,
  );
  const idempotencyKey = firstNonEmpty(
    contextRecord.idempotencyKey,
    contextRecord.idempotency_key,
    payloadTemplate.idempotencyKey,
    payloadTemplate.idempotency_key,
  );
  const body: Record<string, unknown> = { ...payloadTemplate, agentId: agent.id, runId, run_id: runId, context };

  setIfPresent(body, [
    ["agent_id", agent.id],
    ["dispatchId", dispatchId],
    ["dispatch_id", dispatchId],
    ["issueId", issueId],
    ["issue_id", issueId],
    ["taskId", taskId],
    ["task_id", taskId],
    ["companyId", companyId],
    ["company_id", companyId],
    ["idempotencyKey", idempotencyKey],
    ["idempotency_key", idempotencyKey],
  ]);

  const controller = new AbortController();
  const timer = timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const defaultSummary = `HTTP ${method} ${url}`;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      ...(timer ? { signal: controller.signal } : {}),
    });

    const rawBody = await res.text();
    const parsedBody = parseResponseBody(rawBody, res.headers.get("content-type"));
    const jsonBody = asRecord(parsedBody);
    if (jsonBody) {
      return mapJsonResponse({
        payload: jsonBody,
        status: res.status,
        ok: res.ok,
        defaultSummary,
      });
    }

    if (!res.ok) {
      const errorMessage =
        (typeof parsedBody === "string" && parsedBody.trim().length > 0
          ? parsedBody.trim()
          : `HTTP invoke failed with status ${res.status}`);
      return {
        exitCode: res.status,
        signal: null,
        timedOut: false,
        errorMessage,
        errorCode: "http_error",
        summary: errorMessage,
      };
    }

    const textSummary = typeof parsedBody === "string" && parsedBody.trim().length > 0 ? parsedBody.trim() : defaultSummary;
    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      summary: textSummary,
    };
  } catch (err) {
    if (timer && err instanceof Error && err.name === "AbortError") {
      return {
        exitCode: null,
        signal: null,
        timedOut: true,
        errorMessage: `HTTP ${method} ${url} timed out after ${timeoutMs}ms`,
        errorCode: "timeout",
      };
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
