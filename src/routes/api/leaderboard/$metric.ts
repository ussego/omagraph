import "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { desc, inArray, isNotNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { pluginSnapshots, plugins } from "@/db/schema";

import type { LeaderboardResponse } from "@/lib/api-types";

const METRICS = {
	hearts: plugins.currentHearts,
	views: plugins.currentViews,
	copies: plugins.currentCopies,
} as const;

export const Route = createFileRoute("/api/leaderboard/$metric")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const metric = params.metric;
				if (metric !== "copies_per_view" && !(metric in METRICS))
					return Response.json({ error: "unknown metric" }, { status: 400 });
				const db = drizzle(env.DB);
				const q = new URL(request.url).searchParams;
				const limit = Math.min(100, parseInt(q.get("limit") ?? "50", 10) || 50);
				const sparkPoints = Math.min(30, Math.max(0, parseInt(q.get("sparkPoints") ?? "0", 10) || 0));
				// ponytail: fixed k=100 prior views with the live catalog mean as prior; raise k if tiny samples still top.
				const score =
					metric === "copies_per_view"
						? sql<
								number | null
							>`case when coalesce(${plugins.currentViews}, 0) > 0 then (cast(coalesce(${plugins.currentCopies}, 0) as real) + 100 * (select cast(sum(coalesce(${plugins.currentCopies}, 0)) as real) / nullif(sum(coalesce(${plugins.currentViews}, 0)), 0) from ${plugins} where ${plugins.currentSnapshotAt} is not null)) / (coalesce(${plugins.currentViews}, 0) + 100) end`
						: METRICS[metric as keyof typeof METRICS];
				const rows = await db
					.select({
						pluginId: plugins.id,
						name: plugins.name,
						author: plugins.author,
						category: plugins.category,
						views: plugins.currentViews,
						copies: plugins.currentCopies,
						hearts: plugins.currentHearts,
						score,
					})
					.from(plugins)
					.where(isNotNull(plugins.currentSnapshotAt))
					.orderBy(desc(score))
					.limit(limit)
					.all();

				const sparkBy = new Map<
					string,
					{ snapshotAt: string; views: number | null; copies: number | null; hearts: number | null }[]
				>();
				if (sparkPoints > 0 && rows.length) {
					const chunkSize = 90;
					const sparkQuery = (chunk: string[]) => {
						const ranked = db
							.select({
								pluginId: pluginSnapshots.pluginId,
								snapshotAt: pluginSnapshots.snapshotAt,
								views: pluginSnapshots.views,
								copies: pluginSnapshots.copies,
								hearts: pluginSnapshots.hearts,
								rk: sql<number>`row_number() over (partition by ${pluginSnapshots.pluginId} order by ${pluginSnapshots.snapshotAt} desc)`.as(
									"rk",
								),
							})
							.from(pluginSnapshots)
							.where(inArray(pluginSnapshots.pluginId, chunk))
							.as("spark_ranked");
						return db
							.select({
								pluginId: ranked.pluginId,
								snapshotAt: ranked.snapshotAt,
								views: ranked.views,
								copies: ranked.copies,
								hearts: ranked.hearts,
							})
							.from(ranked)
							.where(sql`${ranked.rk} <= ${sparkPoints}`);
					};
					const batches: ReturnType<typeof sparkQuery>[] = [];
					for (let i = 0; i < rows.length; i += chunkSize)
						batches.push(sparkQuery(rows.slice(i, i + chunkSize).map((row) => row.pluginId)));
					const results = await db.batch(
						batches as [ReturnType<typeof sparkQuery>, ...ReturnType<typeof sparkQuery>[]],
					);
					for (const sparks of results) {
						for (const row of sparks) {
							const values = sparkBy.get(row.pluginId) ?? [];
							values.push({
								snapshotAt: row.snapshotAt,
								views: row.views,
								copies: row.copies,
								hearts: row.hearts,
							});
							sparkBy.set(row.pluginId, values);
						}
					}
					for (const values of sparkBy.values())
						values.sort((a, b) => a.snapshotAt.localeCompare(b.snapshotAt));
				}
				return Response.json({
					metric,
					rows: rows.map((row) => ({
						...row,
						...(sparkBy.get(row.pluginId) ? { spark: sparkBy.get(row.pluginId) } : {}),
					})),
				} satisfies LeaderboardResponse);
			},
		},
	},
});
