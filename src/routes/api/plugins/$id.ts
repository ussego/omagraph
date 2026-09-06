import "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { pluginRelations, pluginSnapshots, plugins } from "@/db/schema";
import { placementsByPlugin } from "@/lib/competitions";
import { withoutCurrent } from "@/lib/api-helpers";
import type { PluginDetailResponse, RelatedPlugin } from "@/lib/api-types";
import type { DrizzleDb } from "@/lib/db";

interface StoredRelated {
	pluginId: string;
	similarity: number;
}

/** Explorer relations row → wire shape: names/stars joined from plugins. */
async function relationsPayload(db: DrizzleDb, pluginId: string): Promise<PluginDetailResponse["relations"]> {
	const [row] = await db.select().from(pluginRelations).where(eq(pluginRelations.pluginId, pluginId)).all();
	if (!row?.related) return row ? { cluster: row.cluster, influence: row.influence, related: [] } : null;

	const stored = JSON.parse(row.related) as StoredRelated[];
	const known = await db
		.select({ id: plugins.id, name: plugins.name, author: plugins.author, stars: plugins.stars })
		.from(plugins)
		.where(
			inArray(
				plugins.id,
				stored.map((entry) => entry.pluginId),
			),
		)
		.all();
	const byId = new Map(known.map((plugin) => [plugin.id, plugin]));
	const related: RelatedPlugin[] = [];
	for (const entry of stored) {
		const plugin = byId.get(entry.pluginId);
		if (!plugin) continue; // dropped from the catalog since the last sync
		related.push({
			pluginId: plugin.id,
			name: plugin.name,
			author: plugin.author,
			stars: plugin.stars,
			similarity: entry.similarity,
		});
	}
	return { cluster: row.cluster, influence: row.influence, related };
}

export const Route = createFileRoute("/api/plugins/$id")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				const db = drizzle(env.DB);
				const [plugin] = await db.select().from(plugins).where(eq(plugins.id, params.id)).all();
				if (!plugin) return Response.json({ error: "not found" }, { status: 404 });
				const [snapshots, relations, placements] = await Promise.all([
					db
						.select()
						.from(pluginSnapshots)
						.where(eq(pluginSnapshots.pluginId, params.id))
						.orderBy(pluginSnapshots.snapshotAt)
						.all(),
					relationsPayload(db, params.id),
					placementsByPlugin(db, params.id),
				]);
				const avg = (key: "views" | "copies" | "hearts") => {
					const values = snapshots
						.map((snapshot) => snapshot[key])
						.filter((value): value is number => value != null);
					return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
				};
				return Response.json({
					plugin: { ...withoutCurrent(plugin), tags: plugin.tags ? JSON.parse(plugin.tags) : null },
					snapshots,
					averages: { views: avg("views"), copies: avg("copies"), hearts: avg("hearts") },
					relations,
					placements,
				} satisfies PluginDetailResponse);
			},
		},
	},
});
