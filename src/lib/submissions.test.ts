import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";

import type { DrizzleDb } from "@/lib/db";
import {
	ingestSubmissions,
	readSubmissionCursor,
	submissionStatsResponse,
	submissionIngestSchema,
	submissionStats,
} from "@/lib/submissions";

function testDb() {
	const db = drizzle({ client: new Database(":memory:") }) as unknown as DrizzleDb;
	db.run(sql`CREATE TABLE meta (key TEXT PRIMARY KEY, value INTEGER)`);
	db.run(sql`CREATE TABLE submission_events (
		issue_number INTEGER PRIMARY KEY,
		kind TEXT NOT NULL,
		occurred_at TEXT NOT NULL,
		labels TEXT NOT NULL DEFAULT '[]'
	)`);
	return db;
}

describe("submissionStats", () => {
	it("zero-fills UTC windows and keeps kinds, totals, peaks, and gaps separate", () => {
		const stats = submissionStats(
			[
				{ issueNumber: 1, kind: "plugin", occurredAt: "2026-08-01T10:05:00.000Z" },
				{ issueNumber: 2, kind: "plugin", occurredAt: "2026-08-01T10:35:00.000Z" },
				{ issueNumber: 3, kind: "verification", occurredAt: "2026-09-07T13:00:00.000Z" },
				{ issueNumber: 4, kind: "plugin", occurredAt: "2026-09-08T11:00:00.000Z" },
				{ issueNumber: 5, kind: "plugin", occurredAt: "2026-09-08T12:00:00.000Z" },
				{
					issueNumber: 6,
					kind: "verification",
					occurredAt: "2026-09-08T12:15:00.000Z",
					labels: ["needs-fixes"],
				},
			],
			"2026-09-08T12:34:56.000Z",
			"2026-09-08T12:30:00.000Z",
		);

		expect(stats.syncedAt).toBe("2026-09-08T12:30:00.000Z");
		expect(stats.hourly.points).toHaveLength(24);
		expect(stats.hourly.points[0]).toEqual({
			bucket: "2026-09-07T13:00:00.000Z",
			plugin: 0,
			verification: 1,
		});
		expect(stats.hourly.points.at(-1)).toEqual({
			bucket: "2026-09-08T12:00:00.000Z",
			plugin: 1,
			verification: 1,
		});
		expect(stats.hourly.plugin).toEqual({ total: 2, medianGapMinutes: 60, averageGapMinutes: 60 });
		expect(stats.hourly.verification).toEqual({ total: 2, medianGapMinutes: 1395, averageGapMinutes: 1395 });

		expect(stats.daily.points).toHaveLength(30);
		expect(stats.daily.points[0]?.bucket).toBe("2026-08-10");
		expect(stats.daily.points.at(-1)).toEqual({ bucket: "2026-09-08", plugin: 2, verification: 1 });
		expect(stats.daily.plugin.total).toBe(2);
		expect(stats.daily.verification.total).toBe(2);

		expect(stats.allTime.plugin).toEqual({
			total: 4,
			peakHour: { bucket: "2026-08-01T10:00:00.000Z", count: 2 },
			peakDay: { bucket: "2026-08-01", count: 2 },
		});
		expect(stats.allTime.verification).toEqual({
			total: 2,
			peakHour: { bucket: "2026-09-07T13:00:00.000Z", count: 1 },
			peakDay: { bucket: "2026-09-07", count: 1 },
		});
		expect(stats.verificationTags).toEqual([{ label: "needs-fixes", count: 1 }]);
	});

	it("uses inclusive starts and excludes events after the current instant", () => {
		const stats = submissionStats(
			[
				{ issueNumber: 1, kind: "plugin", occurredAt: "2026-08-09T23:59:59.999Z" },
				{ issueNumber: 2, kind: "plugin", occurredAt: "2026-08-10T00:00:00.000Z" },
				{ issueNumber: 3, kind: "plugin", occurredAt: "2026-09-07T12:59:59.999Z" },
				{ issueNumber: 4, kind: "plugin", occurredAt: "2026-09-07T13:00:00.000Z" },
				{ issueNumber: 5, kind: "plugin", occurredAt: "2026-09-08T12:34:56.001Z" },
			],
			"2026-09-08T12:34:56.000Z",
			null,
		);

		expect(stats.hourly.plugin.total).toBe(1);
		expect(stats.hourly.points[0]?.plugin).toBe(1);
		expect(stats.daily.plugin.total).toBe(3);
		expect(stats.daily.points[0]?.plugin).toBe(1);
		expect(stats.allTime.plugin.total).toBe(5);
	});

	it("reports the median independently from the average arrival gap", () => {
		const stats = submissionStats(
			[
				{ issueNumber: 1, kind: "plugin", occurredAt: "2026-09-08T10:00:00.000Z" },
				{ issueNumber: 2, kind: "plugin", occurredAt: "2026-09-08T10:10:00.000Z" },
				{ issueNumber: 3, kind: "plugin", occurredAt: "2026-09-08T10:30:00.000Z" },
				{ issueNumber: 4, kind: "plugin", occurredAt: "2026-09-08T11:30:00.000Z" },
				{ issueNumber: 5, kind: "plugin", occurredAt: "2026-09-08T11:35:00.000Z" },
			],
			"2026-09-08T12:00:00.000Z",
		);

		expect(stats.hourly.plugin.medianGapMinutes).toBe(15);
		expect(stats.hourly.plugin.averageGapMinutes).toBe(23.75);
	});
});

describe("submission ingestion", () => {
	it("rejects malformed events and cursors", () => {
		expect(
			submissionIngestSchema.safeParse({
				events: [{ issueNumber: 0, kind: "other", occurredAt: "yesterday" }],
				cursor: "later",
			}).success,
		).toBe(false);
		expect(submissionIngestSchema.safeParse({ events: [] }).success).toBe(true);
	});

	it("ignores duplicate retries, keeps the cursor monotonic, and purges only after inserts", async () => {
		const db = testDb();
		let purges = 0;
		const purge = async () => void purges++;
		const events = [
			{ issueNumber: 11, kind: "plugin" as const, occurredAt: "2026-09-08T10:00:00.000Z" },
			{ issueNumber: 12, kind: "verification" as const, occurredAt: "2026-09-08T11:00:00.000Z" },
		];

		expect(await ingestSubmissions(db, { events, cursor: "2026-09-08T12:00:00.000Z" }, purge)).toEqual({
			inserted: 2,
			cursor: "2026-09-08T12:00:00.000Z",
		});
		expect(purges).toBe(1);

		expect(await ingestSubmissions(db, { events, cursor: "2026-09-08T11:00:00.000Z" }, purge)).toEqual({
			inserted: 0,
			cursor: "2026-09-08T12:00:00.000Z",
		});
		expect(purges).toBe(1);

		expect(await ingestSubmissions(db, { events: [], cursor: "2026-09-08T13:00:00.000Z" }, purge)).toEqual({
			inserted: 0,
			cursor: "2026-09-08T13:00:00.000Z",
		});
		expect(purges).toBe(1);
		expect(await readSubmissionCursor(db)).toBe("2026-09-08T13:00:00.000Z");
	});

	it("ingests payloads across D1-safe statement chunks", async () => {
		const db = testDb();
		const events = Array.from({ length: 61 }, (_, index) => ({
			issueNumber: index + 1,
			kind: index % 2 === 0 ? ("plugin" as const) : ("verification" as const),
			occurredAt: `2026-09-08T10:${String(index % 60).padStart(2, "0")}:00.000Z`,
		}));
		let purges = 0;

		expect(await ingestSubmissions(db, { events }, async () => void purges++)).toEqual({
			inserted: 61,
			cursor: null,
		});
		expect(purges).toBe(1);
	});
});

describe("submission stats response", () => {
	it("serializes both windows, all-time metrics, and sync freshness in one response", async () => {
		const db = testDb();
		await ingestSubmissions(
			db,
			{
				events: [{ issueNumber: 21, kind: "plugin", occurredAt: "2026-09-08T12:00:00.000Z" }],
				cursor: "2026-09-08T12:30:00.000Z",
			},
			async () => undefined,
		);

		const response = await submissionStatsResponse(db, "2026-09-08T12:34:56.000Z");
		expect(response.headers.get("content-type")).toContain("application/json");
		expect(await response.json()).toMatchObject({
			hourly: { points: expect.any(Array), plugin: { total: 1 }, verification: { total: 0 } },
			daily: { points: expect.any(Array), plugin: { total: 1 }, verification: { total: 0 } },
			allTime: { plugin: { total: 1 }, verification: { total: 0 } },
			verificationTags: [],
			syncedAt: "2026-09-08T12:30:00.000Z",
		});
	});
});
