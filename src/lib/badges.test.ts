import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";

import { plugins } from "@/db/schema";
import { badgeRank, badgeValue } from "@/lib/badges";
import type { DrizzleDb } from "@/lib/db";

// Mirror of src/db/schema.ts's plugins table so drizzle's insert (which
// writes every column) works. bun:sqlite runs the exact SQL drizzle generates
// for D1.
let queryCount = 0;
const db = drizzle({
	client: new Database(":memory:"),
	logger: { logQuery: () => queryCount++ },
}) as unknown as DrizzleDb;
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

const FIXTURES = [
	{ id: "alice.one", author: "alice", views: 100, copies: 10, hearts: 5 },
	{ id: "alice.two", author: "alice", views: 200, copies: 20, hearts: 10 },
	{ id: "bob.one", author: "bob", views: 100, copies: 50, hearts: 1 },
	{ id: "solo", author: "solo", views: 50, copies: 5, hearts: 1 },
	{ id: "carol.one", author: "carol", views: null, copies: null, hearts: null },
] as const;

await db
	.insert(plugins)
	.values(
		FIXTURES.map((f) => ({
			id: f.id,
			author: f.author,
			currentViews: f.views,
			currentCopies: f.copies,
			currentHearts: f.hearts,
			currentSnapshotAt: "2026-08-30T00:00:00Z",
		})),
	)
	.run();

describe("badge providers", () => {
	it("returns plugin and author values", async () => {
		expect(await badgeValue(db, "views", "alice.one")).toBe(100);
		expect(await badgeValue(db, "views", "alice")).toBe(300);
		expect(await badgeValue(db, "views", "solo")).toBe(50);
		expect(await badgeValue(db, "views", "carol.one")).toBeNull();
		expect(await badgeValue(db, "views", "nobody")).toBeNull();
	});

	it("ranks plugins with ties and excludes null statistics", async () => {
		expect((await badgeRank(db, "views", "alice.two"))?.rank).toBe(1);
		expect((await badgeRank(db, "views", "alice.one"))?.rank).toBe(2);
		expect((await badgeRank(db, "views", "bob.one"))?.rank).toBe(2);
		expect((await badgeRank(db, "views", "solo"))?.rank).toBe(4);
		expect((await badgeRank(db, "views", "solo"))?.total).toBe(4);
		expect(await badgeRank(db, "views", "carol.one")).toBeNull();
		expect(await badgeRank(db, "views", "nobody")).toBeNull();
	});

	it("ranks authors and average statistics", async () => {
		expect((await badgeRank(db, "views", "alice"))?.rank).toBe(1);
		expect((await badgeRank(db, "views", "alice"))?.total).toBe(3);
		expect((await badgeRank(db, "views", "bob"))?.rank).toBe(2);
		expect((await badgeRank(db, "views", "bob"))?.value).toBe(100);
		expect((await badgeRank(db, "avg", "alice.two"))?.rank).toBe(1);
		expect((await badgeRank(db, "avg", "alice"))?.value).toBe((300 + 30 + 15) / 3);
	});

	it("keeps each badge lookup to one statement", async () => {
		for (const lookup of [
			() => badgeValue(db, "views", "alice.one"),
			() => badgeValue(db, "views", "alice"),
			() => badgeRank(db, "views", "alice.one"),
			() => badgeRank(db, "views", "alice"),
		]) {
			const before = queryCount;
			await lookup();
			expect(queryCount - before).toBe(1);
		}
	});
});
