import { eq } from "drizzle-orm";
import { z } from "zod";

import { competitions, placements, plugins } from "@/db/schema";
import type { DrizzleDb } from "@/lib/db";

export const newCompetitionSchema = z
	.object({
		id: z.string().trim().min(1),
		title: z.string().trim().min(1),
		announcedAt: z.iso.date(),
		announcementUrl: z.url(),
	})
	.strict();

export const newPlacementSchema = z
	.object({
		competitionId: z.string().trim().min(1),
		pluginId: z.string().trim().min(1),
		place: z.number().int().nonnegative(),
		prize: z.number().int().nonnegative().nullable(),
	})
	.strict();

export async function createCompetition(db: DrizzleDb, input: z.infer<typeof newCompetitionSchema>) {
	await db.insert(competitions).values(input);
	return input;
}

export async function createPlacement(db: DrizzleDb, input: z.infer<typeof newPlacementSchema>) {
	await db.insert(placements).values(input);
	return input;
}

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
		.select({
			id: competitions.id,
			title: competitions.title,
			announcedAt: competitions.announcedAt,
			announcementUrl: competitions.announcementUrl,
			pluginId: placements.pluginId,
			place: placements.place,
			prize: placements.prize,
			name: plugins.name,
		})
		.from(competitions)
		.leftJoin(placements, eq(placements.competitionId, competitions.id))
		.leftJoin(plugins, eq(plugins.id, placements.pluginId))
		.orderBy(competitions.announcedAt, placements.place)
		.all();
	const result = new Map<
		string,
		{
			id: string;
			title: string;
			announcedAt: string;
			announcementUrl: string;
			placements: { pluginId: string; name: string | null; place: number; prize: number | null }[];
		}
	>();
	for (const row of rows) {
		const competition = result.get(row.id) ?? {
			id: row.id,
			title: row.title,
			announcedAt: row.announcedAt,
			announcementUrl: row.announcementUrl,
			placements: [],
		};
		if (row.pluginId && row.place != null)
			competition.placements.push({ pluginId: row.pluginId, name: row.name, place: row.place, prize: row.prize });
		result.set(row.id, competition);
	}
	return [...result.values()];
}
