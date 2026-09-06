import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";

import { apiFetch } from "./api-url";
import type {
	AuthorDetailResponse,
	AuthorsResponse,
	BreakdownResponse,
	BrokenResponse,
	CategoriesResponse,
	CompetitionsResponse,
	ChartSeriesResponse,
	HealthResponse,
	HeatmapResponse,
	LeaderboardResponse,
	PluginDetailResponse,
	PluginListResponse,
	SearchResponse,
	StatsResponse,
	TrendingResponse,
	UnverifiedResponse,
} from "./api-types";

// ── api access ─────────────────────────────────────────────────────────────

/** A failed API call, carrying the HTTP status so callers can branch on it. */
export class HttpError extends Error {
	constructor(
		public readonly status: number,
		statusText: string,
	) {
		super(`${status} ${statusText}`);
		this.name = "HttpError";
	}
}

async function get<T>(path: string): Promise<T> {
	const res = await apiFetch(path);
	if (!res.ok) throw new HttpError(res.status, res.statusText);
	return res.json() as Promise<T>;
}

// ── query options ──────────────────────────────────────────────────────────
//
// Route loaders call `queryClient.query({ ...options, staleTime: "static" })` with these so SSR
// ships resolved data and hover-preload warms the edge cache; components read
// the same cache with `useSuspenseQuery`. The dashboard's data plane is this
// app's own edge-cached /api server routes — see the comment on `apiFetch`.

export type Granularity = "day" | "month" | "year";

const daysOf = (range: string) => (range === "all" ? undefined : range);

export function statsQuery(
	kind: "published" | "updated" | "verified",
	opts: { range: string; groupBy: Granularity; from?: string; to?: string },
) {
	return queryOptions({
		queryKey: ["stats", kind, daysOf(opts.range), opts.groupBy, opts.from ?? null, opts.to ?? null],
		queryFn: () => {
			const q = new URLSearchParams({ groupBy: opts.groupBy });
			if (daysOf(opts.range)) q.set("range", daysOf(opts.range)!);
			if (opts.from) q.set("from", opts.from);
			if (opts.to) q.set("to", opts.to);
			return get<StatsResponse>(`/api/stats/${kind}?${q}`);
		},
	});
}

export function totalStatsQuery(groupBy: Granularity) {
	return queryOptions({
		queryKey: ["stats", "total", groupBy],
		queryFn: () => get<ChartSeriesResponse>(`/api/charts/omagraph/total?groupBy=${groupBy}`),
	});
}

export function searchQuery(q: string, limit = 8) {
	return queryOptions({
		queryKey: ["search", q, limit],
		queryFn: () => get<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`),
	});
}

export function pluginListQuery(q: string, page: number, pageSize = 50) {
	return queryOptions({
		queryKey: ["plugins", q, page, pageSize],
		queryFn: () =>
			get<PluginListResponse>(`/api/plugins?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`),
	});
}

export function recentPluginsQuery(limit = 8) {
	return queryOptions({
		queryKey: ["plugins", "recent", limit],
		queryFn: () => get<PluginListResponse>(`/api/plugins?sort=addedAt&page=1&pageSize=${limit}`),
	});
}

export function pluginDetailQuery(pluginId: string) {
	return queryOptions({
		queryKey: ["plugins", pluginId],
		queryFn: () => get<PluginDetailResponse>(`/api/plugins/${encodeURIComponent(pluginId)}`),
	});
}

export function competitionsQuery() {
	return queryOptions({ queryKey: ["competitions"], queryFn: () => get<CompetitionsResponse>("/api/competitions") });
}

export function leaderboardQuery(metric: string, limit = 25, sparkPoints = 10) {
	return queryOptions({
		queryKey: ["leaderboard", metric, limit, sparkPoints],
		queryFn: () => get<LeaderboardResponse>(`/api/leaderboard/${metric}?limit=${limit}&sparkPoints=${sparkPoints}`),
	});
}

export function trendingQuery(days: 7 | 30) {
	return queryOptions({
		queryKey: ["trending", days],
		queryFn: () => get<TrendingResponse>(`/api/leaderboard/trending?days=${days}`),
	});
}

export function authorsQuery() {
	return queryOptions({
		queryKey: ["authors"],
		queryFn: () => get<AuthorsResponse>("/api/authors/leaderboard"),
	});
}

export function authorDetailQuery(authorId: string) {
	return queryOptions({
		queryKey: ["authors", authorId],
		queryFn: () => get<AuthorDetailResponse>(`/api/authors/${encodeURIComponent(authorId)}`),
	});
}

export function breakdownQuery() {
	return queryOptions({
		queryKey: ["breakdown"],
		queryFn: () => get<BreakdownResponse>("/api/stats/breakdown"),
	});
}

export function categoriesQuery() {
	return queryOptions({
		queryKey: ["categories"],
		queryFn: () => get<CategoriesResponse>("/api/stats/categories"),
	});
}

export function heatmapQuery(from?: string, to?: string) {
	return queryOptions({
		queryKey: ["heatmap", from ?? null, to ?? null],
		queryFn: () => {
			const q = new URLSearchParams();
			if (from) q.set("from", from);
			if (to) q.set("to", to);
			return get<HeatmapResponse>(`/api/stats/heatmap?${q}`);
		},
	});
}

export function healthQuery() {
	return queryOptions({
		queryKey: ["health"],
		queryFn: () => get<HealthResponse>("/api/health"),
	});
}

export function brokenPluginsQuery() {
	return queryOptions({
		queryKey: ["broken"],
		queryFn: () => get<BrokenResponse>("/api/health/broken"),
	});
}

export function unverifiedPluginsQuery(range: string) {
	return queryOptions({
		queryKey: ["unverified", range],
		queryFn: () => get<UnverifiedResponse>(`/api/health/unverified?range=${range}`),
	});
}

// ── interaction-driven hooks ───────────────────────────────────────────────
//
// The command palette fetches on keystrokes rather than on navigation, so it
// stays on plain useQuery — route loaders would refetch the whole list on
// every debounced change with no keepPreviousData smoothness.

/** Previous results stay on screen while the next query loads. */
export function useSearch(q: string, limit = 8, enabled = true) {
	return useQuery({ ...searchQuery(q, limit), enabled, placeholderData: keepPreviousData });
}

/** Previous results stay on screen while the next query loads. */
export function usePluginList(q: string, page: number, pageSize = 50) {
	return useQuery({ ...pluginListQuery(q, page, pageSize), placeholderData: keepPreviousData });
}

export function useAuthors(enabled = true) {
	return useQuery({ ...authorsQuery(), enabled, placeholderData: keepPreviousData });
}
