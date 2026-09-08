import { env, waitUntil } from "cloudflare:workers";
import { createMiddleware, createStart } from "@tanstack/react-start";

import { apiErrorResponse } from "@/lib/api-error";

/**
 * API responses must speak JSON with the documented `{ error }` shape. The
 * framework's failure modes leak through otherwise: unmatched /api paths come
 * back as the HTML not-found shell, and unhandled route-handler errors are
 * the raw h3 envelope (`{"status":500,"unhandled":true,...}`).
 */
async function apiErrorJson<T>(result: T): Promise<Response | T> {
	const response = result instanceof Response ? result : (result as { response: Response }).response;
	const contentType = response.headers.get("content-type") ?? "";

	if (response.status === 404 && contentType.includes("text/html")) {
		return Response.json({ error: "not found" }, { status: 404 });
	}
	if (response.status >= 500 && contentType.includes("application/json")) {
		const body = await response
			.clone()
			.json()
			.catch(() => null);
		if (body && typeof body === "object" && (body as { unhandled?: unknown }).unhandled === true) {
			return Response.json({ error: "internal server error" }, { status: response.status });
		}
	}
	return result;
}

/**
 * Handler errors propagate as thrown exceptions (h3 serializes them only at
 * the outermost layer), so catch them here and answer with the JSON error
 * shape instead of the raw h3 envelope.
 */
async function apiRun<T>(next: () => Promise<T>): Promise<Response | T> {
	try {
		return await apiErrorJson(await next());
	} catch (err) {
		if (err instanceof Response) return apiErrorJson(err);
		console.error(err);
		return apiErrorResponse(err);
	}
}

/**
 * Per-prefix TTL overrides for the edge cache (seconds). Everything else
 * caches for one hour. Trending only changes at the 3x/day heavy poll, so an
 * 8h TTL costs at most one poll cycle of staleness while cutting its
 * latest-per-plugin D1 reads ~8x. maxAge caps browser caching: without it
 * Cloudflare applies its 4h default Browser Cache TTL, pinning API JSON
 * (and the pages hydrated from it) to pre-sync data for hours.
 */
const CACHE_TTL: [prefix: string, sMaxage: number, maxAge: number][] = [
	["/api/stats/submissions", 600, 60],
	["/api/leaderboard/trending", 28800, 300],
];

const edgeCache = createMiddleware().server(async ({ next, request }) => {
	const url = new URL(request.url);
	if (!url.pathname.startsWith("/api/")) {
		return next();
	}

	// Admin responses are never cached, including authenticated GETs: serving
	// one from the public cache would bypass route-level authentication.
	if (request.method !== "GET" || url.pathname.startsWith("/api/admin/")) {
		return apiRun(() => Promise.resolve(next()));
	}

	if (url.pathname.startsWith("/api/health")) {
		const result = await apiRun(() => Promise.resolve(next()));
		const response = result instanceof Response ? result : result.response;
		const headers = new Headers(response.headers);
		headers.set("Cache-Control", "no-cache");
		return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
	}

	const cache = (globalThis.caches as unknown as { default: Cache }).default;
	const hit = await cache.match(url);
	if (hit) {
		const headers = new Headers(hit.headers);
		headers.set("x-cache", "HIT");
		return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
	}

	const result = await apiRun(() => Promise.resolve(next()));
	const response = result instanceof Response ? result : result.response;
	const headers = new Headers(response.headers);
	const [, sMaxage = 3600, maxAge = 300] =
		CACHE_TTL.find(([prefix]) => url.pathname.startsWith(prefix)) ?? [];
	headers.set("Cache-Control", `public, max-age=${maxAge}, s-maxage=${sMaxage}`);
	headers.set("x-cache", "MISS");
	const output = new Response(response.clone().body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
	if (response.status >= 200 && response.status < 300) waitUntil(cache.put(url, output.clone()));
	return output;
});

export const adminAuth = createMiddleware().server(async ({ next, request }) => {
	const adminToken = (env as CloudflareBindings & { ADMIN_TOKEN?: string }).ADMIN_TOKEN;
	if (!adminToken || request.headers.get("x-admin-token") !== adminToken) {
		return Response.json({ error: "unauthorized" }, { status: 401 });
	}
	try {
		return await next();
	} catch (err) {
		console.error(err);
		return apiErrorResponse(err, true);
	}
});

export const startInstance = createStart(() => ({ requestMiddleware: [edgeCache] }));
