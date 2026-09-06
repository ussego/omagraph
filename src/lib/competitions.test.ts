import { describe, expect, test } from "bun:test";

import { newCompetitionSchema, newPlacementSchema } from "@/lib/competitions";

describe("competition admin input", () => {
	test("accepts a competition and rejects an invalid announcement", () => {
		expect(
			newCompetitionSchema.safeParse({
				id: "comp-02",
				title: "Second competition",
				announcedAt: "2026-12-01",
				announcementUrl: "https://omarchy.org/news/competition-2",
			}).success,
		).toBe(true);
		expect(
			newCompetitionSchema.safeParse({
				id: "comp-02",
				title: "Second competition",
				announcedAt: "December",
				announcementUrl: "not a URL",
			}).success,
		).toBe(false);
	});

	test("accepts a placement and rejects negative values", () => {
		expect(
			newPlacementSchema.safeParse({
				competitionId: "comp-02",
				pluginId: "example-plugin",
				place: 1,
				prize: 2500,
			}).success,
		).toBe(true);
		expect(
			newPlacementSchema.safeParse({
				competitionId: "comp-02",
				pluginId: "example-plugin",
				place: -1,
				prize: -1,
			}).success,
		).toBe(false);
	});
});
