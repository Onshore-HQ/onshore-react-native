/** Talks to your own install's secure component endpoints. No React in here. */

export type VaultErrorCode = "invalid_client_token" | "validation_failed" | "policy_denied" | "rate_limited" | "server" | "transport";

/** What went wrong. It never holds a value. */
export class VaultError extends Error {
  constructor(public code: VaultErrorCode, public fields: string[] = [], public status = 0) {
    super(code);
    this.name = "VaultError";
  }
}

export interface FieldDescription { name: string; data_type: string }
export interface ComponentDescription { kind: "collect" | "reveal"; fields: FieldDescription[]; tokens: number }
export interface RevealedValue { decision?: string; value?: string; error?: { code: string } }

export interface ClientOptions {
  /** Your install, for example https://vault.yourbank.ng */
  baseUrl: string;
  /** `rvapp://` and your app's id, listed under Secure components for the vault. */
  appOrigin: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Holds no credentials. Your server mints a single-use client token and hands it to the
 * app: never put a service account key in an app.
 */
export function createClient(opts: ClientOptions) {
  const doFetch = opts.fetch ?? fetch;
  const post = async (path: string, body: Record<string, unknown>): Promise<any> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);
    let res: Response;
    let json: any;
    try {
      res = await doFetch(`${opts.baseUrl.replace(/\/$/, "")}/embed/v1/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, parent_origin: opts.appOrigin }),
        signal: controller.signal,
      });
      json = await res.json();
    } catch {
      // The system's error can carry the request, so none of it is passed on.
      throw new VaultError("transport");
    } finally {
      clearTimeout(timer);
    }
    if (res.ok) return json;
    const err = json?.error ?? {};
    switch (err.code) {
      case "invalid_client_token": throw new VaultError("invalid_client_token", [], res.status);
      case "validation_failed": throw new VaultError("validation_failed", (err.fields ?? []).map((f: any) => (typeof f === "string" ? f : f.field)), res.status);
      case "policy_denied": throw new VaultError("policy_denied", [], res.status);
      case "rate_limited": case "too_many_requests": throw new VaultError("rate_limited", [], res.status);
      default: throw new VaultError("server", [], res.status);
    }
  };
  return {
    describe: (clientToken: string): Promise<ComponentDescription> => post("describe", { client_token: clientToken }),
    /** Returns a token for each field, which is safe to give your app and server. */
    collect: async (clientToken: string, values: Record<string, string>): Promise<Record<string, string>> => (await post("collect", { client_token: clientToken, values })).tokens,
    /** Asks for the values behind the tokens the client token names. Policy decides each one. */
    reveal: async (clientToken: string): Promise<RevealedValue[]> => (await post("reveal", { client_token: clientToken })).results,
  };
}
export type SecureClient = ReturnType<typeof createClient>;
