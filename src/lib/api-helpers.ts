import { and, count, type SQL, sql } from "drizzle-orm";
import type { plugins, updateEvents, verificationEvents } from "@/db/schema";
import type { StatsResponse } from "@/lib/api-types";
import type { DrizzleDb } from "@/lib/db";

type PluginRow = typeof plugins.$inferSelect;
type CountTable = typeof plugins | typeof updateEvents | typeof verificationEvents;
type CountColumn = typeof plugins.addedAt | typeof updateEvents.occurredAt | typeof verificationEvents.occurredAt;

/** Strip denormalized current_* fields from API responses. */
export function withoutCurrent(r: PluginRow) {
	const {
		currentViews: _cv,
		currentCopies: _cc,
		currentHearts: _ch,
		currentVerificationStatus: _vs,
		currentVersion: _ver,
		currentRepositoryUpdatedAt: _ru,
		currentUpstreamCheckStatus: _us,
		currentSnapshotAt: _sa,
		...rest
	} = r;
	return rest;
}

const dayMs = 864e5;

export function groupLen(groupBy: string | null) {
	return groupBy === "day" ? 10 : groupBy === "year" ? 4 : 7;
}

/** range=7d|30d|90d|180d|365d|1y|all, or explicit from/to ISO dates. */
export function dateRange(q: URLSearchParams) {
	let from: string | undefined;
	let to: string | undefined;
	const range = q.get("range");
	const days = { "7d": 7, "30d": 30, "90d": 90, "180d": 180, "365d": 365, "1y": 365 }[range ?? ""];
	if (days) from = new Date(Date.now() - days * dayMs).toISOString().slice(0, 10);
	if (q.get("from")) from = q.get("from")!;
	if (q.get("to")) to = q.get("to")!;
	return { from, to };
}

/** Shared handler for the three event-count endpoints. */
export function countsRoute(
	db: DrizzleDb,
	table: CountTable,
	col: CountColumn,
	extra: (q: URLSearchParams) => SQL[] = () => [],
) {
	return async ({ request }: { request: Request }) => {
		const q = new URL(request.url).searchParams;
		const n = groupLen(q.get("groupBy"));
		const { from, to } = dateRange(q);
		const bucket = sql<string>`substr(${col}, 1, ${n})`;
		const conds: SQL[] = [sql`${col} is not null`, ...extra(q)];
		if (from) conds.push(sql`${col} >= ${from}`);
		if (to) conds.push(sql`${col} <= ${to}`);
		const rows = await db
			.select({ bucket, count: count() })
			.from(table)
			.where(and(...conds))
			.groupBy(bucket)
			.orderBy(bucket)
			.all();
		return Response.json({
			groupBy: q.get("groupBy") ?? "month",
			from: from ?? null,
			to: to ?? null,
			points: rows,
		} satisfies StatsResponse);
	};
}

export const BADGE_COLORS = { hearts: "red", views: "blue", copies: "green", avg: "purple" } as const;
export const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export const chartMetric = (raw: string): "hearts" | "views" | "copies" | null =>
	raw === "hearts" || raw === "views" || raw === "copies" ? raw : null;

/** Optional `.json` suffix; `.svg` requests get a pointer to shieldcn. */
export const stripChartExt = (s: string): string | null =>
	s.toLowerCase().endsWith(".svg") ? null : s.toLowerCase().endsWith(".json") ? s.slice(0, -5) : s;

export const CHART_SVG_POINTER =
	"omagraph doesn't render SVG — feed shieldcn's /chart/json.svg this URL without the .svg (and without .json; its fetcher rejects dot-suffixed URLs), e.g. ?url=<this without extension>&query=$.points[*].count&dateQuery=$.points[*].date";
