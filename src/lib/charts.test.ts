import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";

import { pluginSnapshots, plugins, updateEvents, verificationEvents } from "@/db/schema";
import {
	omagraphAuthor,
	omagraphPlugin,
	omagraphPublished,
	omagraphTotal,
	omagraphUpdated,
	omagraphVerified,
} from "@/lib/charts";
import type { DrizzleDb } from "@/lib/db";

// Mirror src/db/schema.ts into an in-memory bun:sqlite database so Drizzle's
// generated SQL runs against the exact dialect drizzle-orm/d1 emits.
const db = drizzle({ client: new Database(":memory:") }) as unknown as DrizzleDb;
db.run(sql`CREATE TABLE plugins (
	id TEXT PRIMARY KEY,
	name TEXT,
	description TEXT,
	author TEXT,
	category TEXT,
	kind TEXT,
	license TEXT,
	tags TEXT,
	added_at TEXT,
	repo TEXT,
	stars INTEGER,
	install_available INTEGER,
	status TEXT,
	source_type TEXT,
	current_views INTEGER,
	current_copies INTEGER,
	current_hearts INTEGER,
	current_verification_status TEXT,
	current_version TEXT,
	current_repository_updated_at TEXT,
	current_upstream_check_status TEXT,
	current_snapshot_at TEXT
)`);
db.run(sql`CREATE TABLE plugin_snapshots (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	plugin_id TEXT NOT NULL,
	snapshot_at TEXT NOT NULL,
	views INTEGER,
	copies INTEGER,
	hearts INTEGER,
	verification_status TEXT,
	version TEXT,
	repository_updated_at TEXT,
	upstream_check_status TEXT
)`);
db.run(sql`CREATE TABLE update_events (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	plugin_id TEXT NOT NULL,
	occurred_at TEXT NOT NULL,
	from_version TEXT,
	to_version TEXT
)`);
db.run(sql`CREATE TABLE verification_events (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	plugin_id TEXT NOT NULL,
	occurred_at TEXT NOT NULL,
	from_status TEXT,
	to_status TEXT
)`);

// Fixtures: 2 plugins across 2 authors, several dates, several snapshots.
await db
	.insert(plugins)
	.values([
		{
			id: "alice.one",
			name: "P1",
			author: "alice",
			addedAt: "2026-05-15",
			currentHearts: 100,
			currentViews: 1000,
			currentCopies: 50,
			currentSnapshotAt: "2026-08-30T00:00:00Z",
		},
		{
			id: "alice.two",
			name: "P2",
			author: "alice",
			addedAt: "2026-06-20",
			currentHearts: 200,
			currentViews: 2000,
			currentCopies: 100,
			currentSnapshotAt: "2026-08-30T00:00:00Z",
		},
		{
			id: "bob.one",
			name: "P3",
			author: "bob",
			addedAt: "2026-07-10",
			currentHearts: 50,
			currentViews: 500,
			currentCopies: 25,
			currentSnapshotAt: "2026-08-30T00:00:00Z",
		},
	])
	.run();

await db
	.insert(pluginSnapshots)
	.values([
		{ pluginId: "alice.one", snapshotAt: "2026-08-01T00:00:00Z", hearts: 80, views: 800, copies: 40 },
		{ pluginId: "alice.one", snapshotAt: "2026-08-30T00:00:00Z", hearts: 100, views: 1000, copies: 50 },
		{ pluginId: "alice.two", snapshotAt: "2026-08-01T00:00:00Z", hearts: 150, views: 1500, copies: 75 },
		{ pluginId: "alice.two", snapshotAt: "2026-08-30T00:00:00Z", hearts: 200, views: 2000, copies: 100 },
		{ pluginId: "bob.one", snapshotAt: "2026-08-01T00:00:00Z", hearts: 30, views: 300, copies: 15 },
		{ pluginId: "bob.one", snapshotAt: "2026-08-30T00:00:00Z", hearts: 50, views: 500, copies: 25 },
	])
	.run();

await db
	.insert(updateEvents)
	.values([
		{ pluginId: "alice.one", occurredAt: "2026-06-01T00:00:00Z" },
		{ pluginId: "alice.two", occurredAt: "2026-07-15T00:00:00Z" },
		{ pluginId: "bob.one", occurredAt: "2026-08-20T00:00:00Z" },
	])
	.run();

await db
	.insert(verificationEvents)
	.values([
		{ pluginId: "alice.one", occurredAt: "2026-05-20T00:00:00Z", toStatus: "verified" },
		{ pluginId: "alice.two", occurredAt: "2026-06-25T00:00:00Z", toStatus: "verified" },
		{ pluginId: "bob.one", occurredAt: "2026-07-15T00:00:00Z", toStatus: "broken" },
	])
	.run();

describe("chart data providers", () => {
	it("returns correctly bucketed aggregate series", async () => {
		const pub = await omagraphPublished(db);
		expect(pub.total).toBe(3);
		expect(pub.points).toHaveLength(3);
		expect(pub.points[0]).toMatchObject({ count: 1, date: "2026-05-01" });
		expect(pub.points[1]?.count).toBe(1);
		expect(pub.points[2]?.count).toBe(1);

		const pubDay = await omagraphPublished(db, "day");
		expect(pubDay.points.map((p) => p.date).join(",")).toBe("2026-05-15,2026-06-20,2026-07-10");
		const pubYear = await omagraphPublished(db, "year");
		expect(pubYear.points).toHaveLength(1);
		expect(pubYear.points[0]?.date).toBe("2026-01-01");

		const total = await omagraphTotal(db);
		expect(total.total).toBe(3);
		expect(total.points).toHaveLength(3);
		expect(total.points.map((p) => p.count)).toEqual([1, 2, 3]);

		const upd = await omagraphUpdated(db);
		expect(upd.total).toBe(3);
		expect(upd.points).toHaveLength(3);
	});

	it("filters verification series by status", async () => {
		expect((await omagraphVerified(db, null)).total).toBe(3);
		expect((await omagraphVerified(db, "verified")).total).toBe(2);
		expect((await omagraphVerified(db, "broken")).total).toBe(1);
	});

	it("returns plugin history and author aggregates", async () => {
		const pluginHearts = await omagraphPlugin(db, "alice.one", "hearts");
		expect(pluginHearts).not.toBeNull();
		expect(pluginHearts?.total).toBe(100);
		expect(pluginHearts?.points).toHaveLength(2);
		expect(pluginHearts?.points.map((p) => p.count)).toEqual([80, 100]);

		expect(await omagraphPlugin(db, "ghost.plugin", "hearts")).toBeNull();

		const aliceHearts = await omagraphAuthor(db, "alice", "hearts");
		expect(aliceHearts).not.toBeNull();
		expect(aliceHearts?.total).toBe(300);
		expect(aliceHearts?.points).toHaveLength(2);
		expect(aliceHearts?.points.map((p) => p.count)).toEqual([230, 300]);

		expect(await omagraphAuthor(db, "nobody", "hearts")).toBeNull();
	});
});
