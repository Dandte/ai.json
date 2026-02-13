export interface SemanticError {
  path: string;
  message: string;
  severity: "error" | "warning";
}

type IaJson = Record<string, unknown>;

export function runSemanticValidation(data: IaJson): SemanticError[] {
  const results: SemanticError[] = [];

  checkAuthRequirements(data, results);
  checkSignatureConsistency(data, results);
  checkOAuthScopes(data, results);
  checkRateLimits(data, results);
  checkMetadataDates(data, results);
  checkCapabilitiesConsistency(data, results);

  return results;
}

/** If protected endpoints exist, auth should be defined */
function checkAuthRequirements(data: IaJson, results: SemanticError[]): void {
  const api = data.api as IaJson | undefined;
  if (!api) return;

  const hasProtected =
    api.protected && Object.keys(api.protected as object).length > 0;
  const hasUserRequired =
    api.user_required && Object.keys(api.user_required as object).length > 0;
  const auth = data.auth as IaJson | undefined;

  if (hasProtected && !auth) {
    results.push({
      path: "/api/protected",
      message:
        "Protected endpoints are defined but no auth configuration found. Add an 'auth' section.",
      severity: "warning",
    });
  }

  if (hasUserRequired && !auth) {
    results.push({
      path: "/api/user_required",
      message:
        "User-required endpoints are defined but no auth configuration found. Add an 'auth' section.",
      severity: "warning",
    });
  }

  if (hasUserRequired && auth && !auth.oauth2) {
    results.push({
      path: "/auth",
      message:
        "User-required endpoints exist but no OAuth2 configuration found. Users need OAuth2 to authorize actions.",
      severity: "warning",
    });
  }
}

/** If signed_key auth is defined, security.verify_signature should be true */
function checkSignatureConsistency(
  data: IaJson,
  results: SemanticError[]
): void {
  const auth = data.auth as IaJson | undefined;
  const security = data.security as IaJson | undefined;

  if (auth?.signed_key && security && security.verify_signature !== true) {
    results.push({
      path: "/security/verify_signature",
      message:
        "signed_key authentication is configured but verify_signature is not enabled. Consider setting it to true.",
      severity: "warning",
    });
  }
}

/** Check that scopes referenced in endpoints exist in OAuth2 config */
function checkOAuthScopes(data: IaJson, results: SemanticError[]): void {
  const auth = data.auth as IaJson | undefined;
  const oauth2 = auth?.oauth2 as IaJson | undefined;
  const api = data.api as IaJson | undefined;

  if (!oauth2 || !api) return;

  const definedScopes = new Set(
    Object.keys((oauth2.scopes as object) || {})
  );
  const userRequired = (api.user_required as Record<string, IaJson>) || {};

  for (const [name, endpoint] of Object.entries(userRequired)) {
    const scopes = endpoint.scopes as string[] | undefined;
    if (!scopes) continue;

    for (const scope of scopes) {
      if (!definedScopes.has(scope)) {
        results.push({
          path: `/api/user_required/${name}/scopes`,
          message: `Scope "${scope}" is used but not defined in auth.oauth2.scopes`,
          severity: "error",
        });
      }
    }
  }
}

/** Validate rate limit format is parseable */
function checkRateLimits(data: IaJson, results: SemanticError[]): void {
  const rateLimitPattern = /^\d+\/(second|minute|hour|day)$/;

  // Check global rate limit
  const security = data.security as IaJson | undefined;
  if (security?.rate_limit) {
    const rl = security.rate_limit as string;
    if (!rateLimitPattern.test(rl)) {
      results.push({
        path: "/security/rate_limit",
        message: `Invalid rate limit format: "${rl}". Expected format: "count/period" (e.g., "1000/hour")`,
        severity: "error",
      });
    }
  }

  // Check endpoint-specific rate limits
  const api = data.api as IaJson | undefined;
  if (!api) return;

  for (const level of ["public", "protected", "user_required"] as const) {
    const endpoints = (api[level] as Record<string, IaJson>) || {};
    for (const [name, endpoint] of Object.entries(endpoints)) {
      if (endpoint.rate_limit) {
        const rl = endpoint.rate_limit as string;
        if (!rateLimitPattern.test(rl)) {
          results.push({
            path: `/api/${level}/${name}/rate_limit`,
            message: `Invalid rate limit format: "${rl}". Expected format: "count/period"`,
            severity: "error",
          });
        }
      }
    }
  }
}

/** Check that metadata.updated >= metadata.created */
function checkMetadataDates(data: IaJson, results: SemanticError[]): void {
  const metadata = data.metadata as IaJson | undefined;
  if (!metadata?.created || !metadata?.updated) return;

  const created = new Date(metadata.created as string);
  const updated = new Date(metadata.updated as string);

  if (updated < created) {
    results.push({
      path: "/metadata/updated",
      message:
        "metadata.updated is earlier than metadata.created. The update date should be the same or later.",
      severity: "warning",
    });
  }
}

/** Check that capabilities match actual API structure */
function checkCapabilitiesConsistency(
  data: IaJson,
  results: SemanticError[]
): void {
  const capabilities = data.capabilities as Record<string, boolean> | undefined;
  const api = data.api as IaJson | undefined;
  const webhooks = data.webhooks as object | undefined;

  if (!capabilities || !api) return;

  // If checkout capability is true, check for checkout-related endpoints
  if (capabilities.checkout) {
    const allEndpoints = getAllEndpointNames(api);
    const hasCheckoutEndpoint = allEndpoints.some(
      (name) =>
        name.includes("checkout") ||
        name.includes("order") ||
        name.includes("cart")
    );
    if (!hasCheckoutEndpoint) {
      results.push({
        path: "/capabilities/checkout",
        message:
          "checkout capability is enabled but no cart/order/checkout endpoints found",
        severity: "warning",
      });
    }
  }

  // If webhooks capability is true, check for webhooks section
  if (capabilities.webhooks && !webhooks) {
    results.push({
      path: "/capabilities/webhooks",
      message:
        "webhooks capability is enabled but no webhooks section is defined",
      severity: "warning",
    });
  }
}

function getAllEndpointNames(api: IaJson): string[] {
  const names: string[] = [];
  for (const level of ["public", "protected", "user_required"] as const) {
    const endpoints = api[level] as Record<string, unknown> | undefined;
    if (endpoints) {
      names.push(...Object.keys(endpoints));
    }
  }
  return names;
}
