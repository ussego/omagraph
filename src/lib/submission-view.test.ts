import { describe, expect, it } from "bun:test";

import {
	submissionPeriodSchema,
	submissionSyncIsStale,
	submissionSyncPresentation,
	submissionWindow,
} from "@/lib/submission-view";
import { healthSearchSchema } from "@/routes/health";
import type { SubmissionStatsResponse } from "@/lib/api-types";

describe("submission health view", () => {
	it("defaults invalid periods to hour and switches windows without changing the response", () => {
		expect(submissionPeriodSchema.parse(undefined)).toBe("hour");
		expect(submissionPeriodSchema.parse("invalid")).toBe("hour");
		expect(submissionPeriodSchema.parse("day")).toBe("day");

		const emptyKind = { total: 0, medianGapMinutes: null, averageGapMinutes: null };
		const hourly = { points: [], plugin: emptyKind, verification: emptyKind };
		const daily = { points: [], plugin: emptyKind, verification: emptyKind };
		const stats: SubmissionStatsResponse = {
			hourly,
			daily,
			allTime: {
				plugin: { total: 0, peakHour: null, peakDay: null },
				verification: { total: 0, peakHour: null, peakDay: null },
			},
			verificationTags: [],
			syncedAt: null,
		};
		expect(submissionWindow(stats, "hour")).toBe(hourly);
		expect(submissionWindow(stats, "day")).toBe(daily);
	});

	it("warns only after sync freshness exceeds 15 minutes", () => {
		const now = Date.parse("2026-09-08T12:30:00.000Z");
		expect(submissionSyncIsStale(null, now)).toBe(true);
		expect(submissionSyncIsStale("2026-09-08T12:15:00.000Z", now)).toBe(false);
		expect(submissionSyncIsStale("2026-09-08T12:14:59.999Z", now)).toBe(true);
		expect(submissionSyncPresentation(null, now)).toEqual({ stale: true, label: "Submission sync pending" });
		expect(submissionSyncPresentation("2026-09-08T12:14:59.999Z", now)).toEqual({
			stale: true,
			label: "Stale · last synced 15 minutes ago",
		});
		expect(submissionSyncPresentation("2026-09-08T12:27:00.000Z", now)).toEqual({
			stale: false,
			label: "Last synced 3 minutes ago",
		});
	});

	it("keeps the selected submission period in validated health URL state", () => {
		expect(healthSearchSchema.parse({ submissionPeriod: "day" })).toMatchObject({ submissionPeriod: "day" });
	});
});
