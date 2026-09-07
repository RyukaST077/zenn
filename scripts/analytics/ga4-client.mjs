// Minimal Google Analytics Data API client.
//
// No gcloud, no npm packages: a service-account JWT is signed with node:crypto
// and exchanged for an access token. That matters because this runs from a
// launchd job with no interactive session, so an OAuth user flow (or an MCP
// connector) is not usable here.
//
// Scope is read-only analytics. Nothing in this file writes to Google.

import crypto from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const DATA_API = "https://analyticsdata.googleapis.com/v1beta";
const ADMIN_API = "https://analyticsadmin.googleapis.com/v1beta";

const base64url = (input) => Buffer.from(input)
  .toString("base64")
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

/**
 * Build the signed JWT bearer assertion. Split out from the token exchange so
 * the signing can be verified in a test without touching the network.
 */
export const signAssertion = (key, atSeconds = Math.floor(Date.now() / 1000)) => {
  if (!key?.client_email || !key?.private_key) {
    throw new Error("service account key must contain client_email and private_key");
  }
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({
    iss: key.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: atSeconds,
    exp: atSeconds + 3600,
  }));
  const signature = base64url(
    crypto.sign("RSA-SHA256", Buffer.from(`${header}.${claims}`), key.private_key),
  );
  return `${header}.${claims}.${signature}`;
};

/**
 * Trade the assertion for an access token. Tokens last an hour; a single
 * pipeline run needs one.
 */
export const accessToken = async (key) => {
  const assertion = signAssertion(key);

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`token exchange failed (${response.status}): ${body.slice(0, 400)}`);
  }
  const token = JSON.parse(body).access_token;
  if (!token) throw new Error(`token exchange returned no access_token: ${body.slice(0, 200)}`);
  return token;
};

const callJson = async (url, token, init = {}) => {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await response.text();
  if (!response.ok) {
    // 403 here almost always means the service account was never granted
    // Viewer on the GA4 property, which is a separate step from enabling the
    // API in the GCP project. Say so instead of surfacing a bare status.
    const hint = response.status === 403
      ? " (the service account likely lacks Viewer on the GA4 property, or the Analytics Data API is not enabled on the project)"
      : "";
    throw new Error(`${url.split("?")[0]} failed (${response.status})${hint}: ${body.slice(0, 500)}`);
  }
  return JSON.parse(body);
};

/**
 * Every GA4 property the service account can read, with its numeric id. Used to
 * resolve a measurement id (G-XXXXXXX) to the property id the Data API needs --
 * they are different identifiers and the console shows them in different places.
 */
export const accountSummaries = async (token) => {
  const summaries = [];
  let pageToken;
  do {
    const url = new URL(`${ADMIN_API}/accountSummaries`);
    url.searchParams.set("pageSize", "200");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const page = await callJson(url.toString(), token);
    summaries.push(...(page.accountSummaries ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return summaries;
};

/** Data streams of one property, so a measurement id can be matched to it. */
export const dataStreams = async (token, propertyId) => {
  const url = `${ADMIN_API}/properties/${propertyId}/dataStreams?pageSize=200`;
  const page = await callJson(url, token);
  return page.dataStreams ?? [];
};

/**
 * Run one report, following pagination. `limit` is the page size; GA4 caps a
 * single response at 100k rows, and a year of (date x pagePath) for one blog
 * runs to tens of thousands.
 */
export const runReport = async (token, propertyId, request, { pageSize = 100000 } = {}) => {
  const rows = [];
  let offset = 0;
  let meta = null;
  for (;;) {
    const page = await callJson(
      `${DATA_API}/properties/${propertyId}:runReport`,
      token,
      { method: "POST", body: JSON.stringify({ ...request, limit: pageSize, offset }) },
    );
    meta = meta ?? {
      dimensionHeaders: page.dimensionHeaders ?? [],
      metricHeaders: page.metricHeaders ?? [],
      rowCount: page.rowCount ?? 0,
      // GA4 silently withholds rows when thresholds apply (small audiences with
      // demographics enabled). Carry the flag so a report can say so.
      metadata: page.metadata ?? {},
      propertyQuota: page.propertyQuota ?? null,
    };
    const pageRows = page.rows ?? [];
    rows.push(...pageRows);
    offset += pageRows.length;
    if (pageRows.length === 0 || offset >= (page.rowCount ?? 0)) break;
  }
  return { ...meta, rows };
};

/**
 * Property details. `timeZone` matters for correctness: the `date` dimension is
 * bucketed in the property's reporting timezone, while Zenn publishes with a
 * +09:00 timestamp. If they disagree, a D7 window is off by a day.
 */
export const propertyDetails = async (token, propertyId) => {
  try {
    return await callJson(`${ADMIN_API}/properties/${propertyId}`, token);
  } catch (error) {
    return { error: error.message };
  }
};

/** The property's configured event-data retention, e.g. TWO_MONTHS / FOURTEEN_MONTHS. */
export const dataRetention = async (token, propertyId) => {
  try {
    return await callJson(`${ADMIN_API}/properties/${propertyId}/dataRetentionSettings`, token);
  } catch (error) {
    // Not fatal: retention only affects how far back a backfill can reach.
    return { error: error.message };
  }
};
