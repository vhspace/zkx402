function coerceTimeoutMs(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function interpretVerifyResponse(data) {
  if (!data || typeof data !== "object") return null;
  if (data.verified === true) return true;
  if (data.valid === true) return true;
  if (data.success === true && !data.error) return true;
  if (data.status === "success" && !data.error) return true;
  if (data.verified === false) return false;
  if (data.valid === false) return false;
  return null;
}

async function safeReadJson(res) {
  try {
    if (typeof res.json === "function") return await res.json();
  } catch {
    // fall through
  }
  try {
    if (typeof res.text === "function") {
      const t = await res.text();
      return JSON.parse(t);
    }
  } catch {
    // ignore
  }
  return null;
}

export function createSelfApiProvider(options = {}) {
  const apiUrl = options.apiUrl || process.env.SELF_API_URL || null;
  const apiKey = options.apiKey || process.env.SELF_API_KEY || null;
  const timeoutMs = coerceTimeoutMs(
    options.timeoutMs ?? process.env.SELF_API_TIMEOUT_MS,
    8000
  );
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  async function verifyViaApi({ walletAddress, claim, policy, selfProof, correlationId }) {
    if (!apiUrl) {
      return { ok: false, status: "not_configured", reason: "Missing SELF_API_URL" };
    }
    if (typeof fetchImpl !== "function") {
      return { ok: false, status: "not_configured", reason: "Missing fetch implementation" };
    }
    if (!walletAddress) {
      return { ok: false, status: "invalid_input", reason: "Missing wallet address" };
    }
    if (!selfProof) {
      return { ok: false, status: "invalid_input", reason: "Missing Self proof payload (x-self-proof)" };
    }

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    if (correlationId) headers["X-Correlation-Id"] = String(correlationId);

    const body = {
      vendor: "self.xyz",
      scope: policy?.scope || null,
      subject: { walletAddress: String(walletAddress).toLowerCase() },
      claim,
      proof: selfProof,
    };

    try {
      const res = await fetchImpl(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller?.signal,
      });

      const data = await safeReadJson(res);
      if (!res?.ok) {
        return {
          ok: false,
          status: "api_error",
          reason: `Self API error: ${res?.status ?? "unknown"}`,
          errorDetails: data,
        };
      }

      const interpreted = interpretVerifyResponse(data);
      if (interpreted === null) {
        return {
          ok: false,
          status: "bad_response",
          reason: "Self API response did not include a recognizable verification result",
          errorDetails: data,
        };
      }

      return { ok: true, verified: interpreted, apiResult: data };
    } catch (error) {
      const msg = error?.name === "AbortError" ? "Self API request timed out" : error?.message || "Self API request failed";
      return { ok: false, status: "error", reason: msg };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return {
    name: "self_api",
    kind: "api",
    supportsClaims: ["human", "age_gte", "excluded_countries_not_contains", "ofac_clear"],
    verifyHuman: (ctx) => verifyViaApi(ctx),
    verifyAgeGte: (ctx) => verifyViaApi(ctx),
    verifyExcludedCountriesNotContains: (ctx) => verifyViaApi(ctx),
    verifyOfacClear: (ctx) => verifyViaApi(ctx),
    meta: { apiUrl, timeoutMs },
  };
}

