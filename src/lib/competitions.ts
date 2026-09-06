import { eq } from "drizzle-orm";

import { competitions, placements, plugins } from "@/db/schema";
import type { DrizzleDb } from "@/lib/db";

export async function placementsByPlugin(db: DrizzleDb, pluginId: string) {
	return db
		.select({
			competitionId: placements.competitionId,
			place: placements.place,
			prize: placements.prize,
			title: competitions.title,
			announcedAt: competitions.announcedAt,
			announcementUrl: competitions.announcementUrl,
		})
		.from(placements)
		.innerJoin(competitions, eq(placements.competitionId, competitions.id))
		.where(eq(placements.pluginId, pluginId))
		.orderBy(placements.place)
		.all();
}

export async function competitionList(db: DrizzleDb) {
	const rows = await db
		.select({ id: competitions.id, title: competitions.title, announcedAt: competitions.announcedAt, announcementUrl: competitions.announcementUrl, pluginId: placements.pluginId, place: placements.place, prize: placements.prize, name: plugins.name })
		.from(competitions)
		.leftJoin(placements, eq(placements.competitionId, competitions.id))
		.leftJoin(plugins, eq(plugins.id, placements.pluginId))
		.orderBy(competitions.announcedAt, placements.place)
		.all();
	const result = new Map<string, { id: string; title: string; announcedAt: string; announcementUrl: string; placements: { pluginId: string; name: string | null; place: number; prize: number | null }[] }>();
	for (const row of rows) {
		const competition = result.get(row.id) ?? { id: row.id, title: row.title, announcedAt: row.announcedAt, announcementUrl: row.announcementUrl, placements: [] };
		if (row.pluginId && row.place != null) competition.placements.push({ pluginId: row.pluginId, name: row.name, place: row.place, prize: row.prize });
		result.set(row.id, competition);
	}
	return [...result.values()];
}
