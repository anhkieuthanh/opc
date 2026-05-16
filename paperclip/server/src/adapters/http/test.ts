import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "../types.js";
import { asString, parseObject } from "../utils.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function normalizeMethod(input: string): string {
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed.toUpperCase() : "POST";
}

function toStringRecord(value: unknown): Record<string, string> {
  const parsed = parseObject(value);
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(parsed)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const urlValue = asString(config.url, "");
  const method = normalizeMethod(asString(config.method, "POST"));
  const healthUrlValue = asString(config.healthUrl, "");
  const healthMethod = normalizeMethod(asString(config.healthMethod, healthUrlValue ? "GET" : "HEAD"));
  const headers = toStringRecord(config.headers);

  if (!urlValue) {
    checks.push({
      code: "http_url_missing",
      level: "error",
      message: "HTTP adapter requires a URL.",
      hint: "Set adapterConfig.url to an absolute http(s) endpoint.",
    });
    return {
      adapterType: ctx.adapterType,
      status: summarizeStatus(checks),
      checks,
      testedAt: new Date().toISOString(),
    };
  }

  let url: URL | null = null;
  try {
    url = new URL(urlValue);
  } catch {
    checks.push({
      code: "http_url_invalid",
      level: "error",
      message: `Invalid URL: ${urlValue}`,
    });
  }

  if (url && url.protocol !== "http:" && url.protocol !== "https:") {
    checks.push({
      code: "http_url_protocol_invalid",
      level: "error",
      message: `Unsupported URL protocol: ${url.protocol}`,
      hint: "Use an http:// or https:// endpoint.",
    });
  }

  if (url) {
    checks.push({
      code: "http_url_valid",
      level: "info",
      message: `Configured endpoint: ${url.toString()}`,
    });
  }

  let healthUrl: URL | null = null;
  if (healthUrlValue) {
    try {
      healthUrl = new URL(healthUrlValue);
      checks.push({
        code: "http_health_url_configured",
        level: "info",
        message: `Configured health probe endpoint: ${healthUrl.toString()}`,
      });
    } catch {
      checks.push({
        code: "http_health_url_invalid",
        level: "error",
        message: `Invalid health URL: ${healthUrlValue}`,
      });
    }
  }

  checks.push({
    code: "http_method_configured",
    level: "info",
    message: `Configured method: ${method}`,
  });

  if (url && (url.protocol === "http:" || url.protocol === "https:")) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const probeUrl = healthUrl ?? url;
      const probeMethod = healthUrl ? healthMethod : "HEAD";
      let response = await fetch(probeUrl, {
        method: probeMethod,
        headers,
        signal: controller.signal,
      });
      let effectiveMethod = probeMethod;
      if (!healthUrl && (response.status === 405 || response.status === 501)) {
        response = await fetch(probeUrl, {
          method: "GET",
          headers,
          signal: controller.signal,
        });
        effectiveMethod = "GET";
      }
      if (!response.ok) {
        checks.push({
          code: "http_endpoint_probe_unexpected_status",
          level: "warn",
          message: `Endpoint probe returned HTTP ${response.status} for ${effectiveMethod} ${probeUrl.toString()}.`,
          hint:
            "Verify the endpoint is reachable from the Paperclip server host and configure adapterConfig.healthUrl when the dispatch endpoint is not safe to probe directly.",
        });
      } else {
        checks.push({
          code: "http_endpoint_probe_ok",
          level: "info",
          message: `Endpoint responded to a ${effectiveMethod} probe at ${probeUrl.toString()}.`,
        });
      }
    } catch (err) {
      checks.push({
        code: "http_endpoint_probe_failed",
        level: "warn",
        message: err instanceof Error ? err.message : "Endpoint probe failed",
        hint:
          "This may be expected in restricted networks; verify connectivity when invoking runs or configure adapterConfig.healthUrl for a safer bridge health check.",
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
