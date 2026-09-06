import { and, isNotNull, type SQL, sql } from "drizzle-orm";

import { plugins } from "@/db/schema";
import type { DrizzleDb } from "@/lib/db";

const STATS = ["views", "copies", "hearts"] as const;
export type Stat = (typeof STATS)[number];
const RANK_STATS = [...STATS, "avg"] as const;
export type RankStat = (typeof STATS)[number] | "avg";

export const isStat = (v: string): v is Stat => (STATS as readonly string[]).includes(v);
export const isRankStat = (v: string): v is RankStat => (RANK_STATS as readonly string[]).includes(v);

const COL = {
	views: plugins.currentViews,
	copies: plugins.currentCopies,
	hearts: plugins.currentHearts,
} as const;

/** Per-plugin score: the stat value, or the mean of the three for avg. */
const score = (stat: RankStat) =>
	stat === "avg"
		? sql<number>`(coalesce(${plugins.currentViews}, 0) + coalesce(${plugins.currentCopies}, 0) + coalesce(${plugins.currentHearts}, 0)) / 3.0`
		: sql<number>`${COL[stat]}`;

/** Per-author score: sum of the stat, or the mean of the three sums for avg. */
const authorScore = (stat: RankStat) =>
	stat === "avg"
		? sql<number>`(coalesce(sum(${plugins.currentViews}), 0) + coalesce(sum(${plugins.currentCopies}), 0) + coalesce(sum(${plugins.currentHearts}), 0)) / 3.0`
		: sql<number>`coalesce(sum(${COL[stat]}), 0)`;

/** A plugin is ranked for a stat only if it has a value for it (avg: any snapshot). */
const hasScore = (stat: RankStat): SQL | undefined =>
	stat === "avg"
		? isNotNull(plugins.currentSnapshotAt)
		: and(isNotNull(plugins.currentSnapshotAt), isNotNull(COL[stat]));

/**
 * Badge value for a stat. Dotted id = the plugin; bare id = the plugin of
 * that exact id if one exists (bare-id plugins count as their own author),
 * else the sum across the author's snapshot'd plugins. Null when nothing
 * matches, so the route can 404.
 */
export async function badgeValue(db: DrizzleDb, stat: Stat, id: string): Promise<number | null> {
	const value = COL[stat];
	const [row] = await db.all<{
		exact: number | null;
		exact_value: number | null;
		authored: number | null;
		author_value: number;
	}>(sql`select
		max(case when ${plugins.id} = ${id} then 1 else 0 end) as exact,
		max(case when ${plugins.id} = ${id} then ${value} end) as exact_value,
		sum(case when ${plugins.author} = ${id} and ${plugins.currentSnapshotAt} is not null then 1 else 0 end) as authored,
		coalesce(sum(case when ${plugins.author} = ${id} and ${plugins.currentSnapshotAt} is not null then coalesce(${value}, 0) else 0 end), 0) as author_value
	from ${plugins}
	where ${plugins.id} = ${id} or ${plugins.author} = ${id}`);
	if (row?.exact) return row.exact_value;
	return row?.authored ? row.author_value : null;
}

export type BadgeRank = { rank: number; total: number; value: number };

/**
 * Competition rank (1 = highest, ties share a place) among plugins for a
 * dotted id, among authors for a bare id (plugin of that exact id wins).
 */
export async function badgeRank(db: DrizzleDb, stat: RankStat, id: string): Promise<BadgeRank | null> {
	if (id.includes(".")) {
		const [row] = await db.all<BadgeRank>(sql`with scores as (
			select ${plugins.id} as id, ${score(stat)} as value
			from ${plugins}
			where ${hasScore(stat)}
		), ranked as (
			select id, value, rank() over (order by value desc) as rank, count(*) over () as total
			from scores
		)
		select rank, total, value from ranked where id = ${id}`);
		return row ?? null;
	}

	const [row] = await db.all<BadgeRank>(sql`with plugin_scores as (
		select ${plugins.id} as id, ${score(stat)} as value
		from ${plugins}
		where ${hasScore(stat)}
	), plugin_ranked as (
		select id, value, rank() over (order by value desc) as rank, count(*) over () as total
		from plugin_scores
	), author_scores as (
		select ${plugins.author} as id, ${authorScore(stat)} as value
		from ${plugins}
		where ${hasScore(stat)}
		group by ${plugins.author}
	), author_ranked as (
		select id, value, rank() over (order by value desc) as rank, count(*) over () as total
		from author_scores
	)
	select rank, total, value from plugin_ranked where id = ${id}
	union all
	select rank, total, value from author_ranked
	where id = ${id} and not exists (select 1 from ${plugins} where ${plugins.id} = ${id})
	limit 1`);
	return row ?? null;
}
