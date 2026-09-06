import { eq } from "drizzle-orm";

import { competitions, placements } from "@/db/schema";
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
