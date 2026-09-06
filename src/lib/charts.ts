/**
 * charts.ts
 *
 * D1-backed chart-data providers. Rendering is shieldcn's job (its
 * `/chart/json.svg` pulls JSON via JSONPath); omagraph only serves the
 * series. The JSON shape matches shieldcn's documented example verbatim:
 * `query=$.points[*].count` + `dateQuery=$.points[*].date`.
 *
 * Query budget: each chart is 1-2 statements (one GROUP BY for aggregates;
 * one row lookup + one snapshots read for per-plugin). Well within the 50
 * statements/invocation D1 Free cap.
 *
 * Data freshness: the heavy poll runs every 8h. 1h edge-cache (matching
 * `/api/stats/*`) is the right cadence for charts.
 */

import { and, asc, count, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { pluginSnapshots, plugins, updateEvents, verificationEvents } from "@/db/schema";
import { CHUNK, type DrizzleDb } from "@/lib/db";

/** A single point on a cumulative time series. `count` matches shieldcn's JSONPath example. */
export interface SeriesPoint {
	date: string;
	count: number;
}

/** Resolved time series for any chart kind. */
export interface CumulativeSeries {
	title: string;
	subtitle?: string;
	link?: string;
	total: number;
	points: SeriesPoint[];
}

/** `day` = 10 chars (YYYY-MM-DD); `month` = 7 chars (YYYY-MM); `year` = 4. */
const GROUP_LEN = { day: 10, month: 7, year: 4 } as const;
type GroupBy = keyof typeof GROUP_LEN;

/** Pad a bucket prefix to a full ISO date: YYYY-MM-DD stays, YYYY-MM gains -01, YYYY gains -01-01. */
function padBucket(bucket: string, groupBy: GroupBy): string {
	if (groupBy === "day") return bucket;
	return groupBy === "year" ? `${bucket}-01-01` : `${bucket}-01`;
}

/** Group rows by a time column and count. Returns ascending date series. */
async function countsOverTime(
	db: DrizzleDb,
	table: typeof plugins | typeof updateEvents | typeof verificationEvents,
	col: typeof plugins.addedAt | typeof updateEvents.occurredAt | typeof verificationEvents.occurredAt,
	extra: ReturnType<typeof sql>[] = [],
	groupBy: GroupBy = "month",
): Promise<CumulativeSeries> {
	const n = GROUP_LEN[groupBy];
	const bucket = sql<string>`substr(${col}, 1, ${n})`;
	const rows = await db
		.select({ bucket, count: count() })
		.from(table)
		.where(and(sql`${col} is not null`, ...extra))
		.groupBy(bucket)
		.orderBy(bucket)
		.all();
	// bucket is a leading prefix of an ISO date — pad it so the date axis
	// gets a real date (day buckets are already full dates).
	const points = rows
		.filter((r): r is { bucket: string; count: number } => typeof r.bucket === "string")
		.map((r) => ({ date: padBucket(r.bucket, groupBy), count: r.count }));
	const total = points.reduce((a, p) => a + p.count, 0);
	return {
		title: "plugins",
		total,
		points,
	};
}

/**
 * Cumulative plugin count over time. Every plugin contributes +1 at its
 * `addedAt`, so this is the running total — never decreases.
 */
async function totalOverTime(db: DrizzleDb, groupBy: GroupBy = "month"): Promise<CumulativeSeries> {
	const n = GROUP_LEN[groupBy];
	const bucket = sql<string>`substr(${plugins.addedAt}, 1, ${n})`;
	const rows = await db
		.select({ bucket, count: count() })
		.from(plugins)
		.where(isNotNull(plugins.addedAt))
		.groupBy(bucket)
		.orderBy(bucket)
		.all();
	let running = 0;
	const points = rows
		.filter((r): r is { bucket: string; count: number } => typeof r.bucket === "string")
		.map((r) => {
			running += r.count;
			return { date: padBucket(r.bucket, groupBy), count: running };
		});
	return { title: "total plugins", total: running, points };
}

/** A plugin's `metric` history (hearts / views / copies), in time order. */
async function pluginMetricOverTime(
	db: DrizzleDb,
	pluginId: string,
	metric: "hearts" | "views" | "copies",
): Promise<CumulativeSeries | null> {
	const col =
		metric === "hearts"
			? pluginSnapshots.hearts
			: metric === "views"
				? pluginSnapshots.views
				: pluginSnapshots.copies;
	const [plugin] = await db
		.select({ id: plugins.id, name: plugins.name })
		.from(plugins)
		.where(eq(plugins.id, pluginId))
		.all();
	if (!plugin) return null;
	const rows = await db
		.select({ at: pluginSnapshots.snapshotAt, value: col })
		.from(pluginSnapshots)
		.where(and(eq(pluginSnapshots.pluginId, pluginId), isNotNull(col)))
		.orderBy(asc(pluginSnapshots.snapshotAt))
		.all();
	const points = rows
		.filter((r): r is { at: string; value: number } => typeof r.value === "number")
		.map((r) => ({ date: r.at, count: r.value }));
	if (points.length === 0) {
		return { title: plugin.name ?? plugin.id, total: 0, points: [] };
	}
	const last = points[points.length - 1]!.count;
	return {
		title: plugin.name ?? plugin.id,
		subtitle: `${last.toLocaleString("en-US")} ${metric}`,
		link: `/plugins/${plugin.id}`,
		total: last,
		points,
	};
}

/**
 * An author's total `metric` over time — sum across their plugins' snapshots
 * at each timestamp. Coarse (one point per snapshot timestamp, summed across
 * the author's plugins). 90-day snapshot retention keeps the curve bounded.
 *
 * For large authors (>30 plugins) this could explode in row count. We cap by
 * taking only the most recent snapshot per (pluginId, snapshotAt) — which is
 * what the table naturally has, one row per (pluginId, snapshotAt).
 */
async function authorMetricOverTime(
	db: DrizzleDb,
	author: string,
	metric: "hearts" | "views" | "copies",
): Promise<CumulativeSeries | null> {
	const col =
		metric === "hearts"
			? pluginSnapshots.hearts
			: metric === "views"
				? pluginSnapshots.views
				: pluginSnapshots.copies;
	// 1. Plugins by author.
	const authorPlugins = await db.select({ id: plugins.id }).from(plugins).where(eq(plugins.author, author)).all();
	if (authorPlugins.length === 0) return null;

	// 2. Sum the metric at each snapshot timestamp across all of the author's
	//    plugins. Drizzle's chunked IN list (db.ts exports CHUNK=100).
	const pluginIds = authorPlugins.map((p) => p.id);
	const sums = new Map<string, number>();
	for (let i = 0; i < pluginIds.length; i += CHUNK) {
		const chunk = pluginIds.slice(i, i + CHUNK);
		const rows = await db
			.select({ at: pluginSnapshots.snapshotAt, value: col })
			.from(pluginSnapshots)
			.where(and(inArray(pluginSnapshots.pluginId, chunk), isNotNull(col)))
			.all();
		for (const r of rows) {
			if (typeof r.value !== "number") continue;
			sums.set(r.at, (sums.get(r.at) ?? 0) + r.value);
		}
	}
	const points = [...sums.entries()]
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([date, value]) => ({ date, count: value }));
	const last = points.length > 0 ? points[points.length - 1]!.count : 0;
	return {
		title: author,
		subtitle: `${last.toLocaleString("en-US")} ${metric} across ${pluginIds.length} plugins`,
		total: last,
		points,
	};
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function omagraphPublished(db: DrizzleDb, groupBy: GroupBy = "month"): Promise<CumulativeSeries> {
	const series = await countsOverTime(db, plugins, plugins.addedAt, [], groupBy);
	return { ...series, title: "plugins published", subtitle: `${series.total.toLocaleString("en-US")} new` };
}

export async function omagraphUpdated(db: DrizzleDb, groupBy: GroupBy = "month"): Promise<CumulativeSeries> {
	const series = await countsOverTime(db, updateEvents, updateEvents.occurredAt, [], groupBy);
	return { ...series, title: "plugin updates", subtitle: `${series.total.toLocaleString("en-US")} updates` };
}

export async function omagraphVerified(
	db: DrizzleDb,
	toStatus: string | null,
	groupBy: GroupBy = "month",
): Promise<CumulativeSeries> {
	const extra = toStatus ? [sql`${verificationEvents.toStatus} = ${toStatus}`] : [];
	const series = await countsOverTime(db, verificationEvents, verificationEvents.occurredAt, extra, groupBy);
	return {
		...series,
		title: toStatus ? `${toStatus} verifications` : "verifications",
		subtitle: `${series.total.toLocaleString("en-US")} events`,
	};
}

export async function omagraphTotal(db: DrizzleDb, groupBy: GroupBy = "month"): Promise<CumulativeSeries> {
	const series = await totalOverTime(db, groupBy);
	return { ...series, subtitle: `${series.total.toLocaleString("en-US")} total` };
}

export function omagraphPlugin(
	db: DrizzleDb,
	pluginId: string,
	metric: "hearts" | "views" | "copies",
): Promise<CumulativeSeries | null> {
	return pluginMetricOverTime(db, pluginId, metric);
}

export function omagraphAuthor(
	db: DrizzleDb,
	author: string,
	metric: "hearts" | "views" | "copies",
): Promise<CumulativeSeries | null> {
	return authorMetricOverTime(db, author, metric);
}
