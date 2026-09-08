import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// plugins: dimension table, upserted on every snapshot poll
export const plugins = sqliteTable(
	"plugins",
	{
		id: text("id").primaryKey(),
		name: text("name"),
		description: text("description"),
		author: text("author"),
		category: text("category"),
		kind: text("kind"),
		license: text("license"),
		tags: text("tags"), // JSON-encoded array
		addedAt: text("added_at"), // immutable publish date, from catalog
		repo: text("repo"),
		stars: integer("stars"),
		installAvailable: integer("install_available", { mode: "boolean" }),
		status: text("status"), // Available / Manual setup / Status unknown / ...
		sourceType: text("source_type"), // builtin / community
		// Denormalized "current state" from the latest snapshot row, so
		// leaderboard/list reads never scan plugin_snapshots. Updated by the
		// heavy cron on every poll (and by the light poll for fresh counts).
		currentViews: integer("current_views"),
		currentCopies: integer("current_copies"),
		currentHearts: integer("current_hearts"),
		currentVerificationStatus: text("current_verification_status"),
		currentVersion: text("current_version"),
		currentRepositoryUpdatedAt: text("current_repository_updated_at"),
		currentUpstreamCheckStatus: text("current_upstream_check_status"),
		currentSnapshotAt: text("current_snapshot_at"),
	},
	(t) => [index("plugins_added_at_idx").on(t.addedAt), index("plugins_author_idx").on(t.author)],
);

// plugin_snapshots: fact table, one row per plugin per poll
export const pluginSnapshots = sqliteTable(
	"plugin_snapshots",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		pluginId: text("plugin_id").notNull(),
		snapshotAt: text("snapshot_at").notNull(),
		views: integer("views"),
		copies: integer("copies"),
		hearts: integer("hearts"),
		verificationStatus: text("verification_status"),
		version: text("version"),
		repositoryUpdatedAt: text("repository_updated_at"),
		upstreamCheckStatus: text("upstream_check_status"),
	},
	(t) => [
		index("snapshots_plugin_time_idx").on(t.pluginId, t.snapshotAt),
		index("snapshots_time_idx").on(t.snapshotAt),
	],
);

// plugin_relations: explorer graph state, synced by the daily explorer poll
// from explorer-data.json (community plugins only; built-ins get no row).
// Written solely by that poll, never by the catalog upsert, so `related` is
// JSON-encoded [{pluginId, similarity}] and `cluster` is the upstream label.
export const pluginRelations = sqliteTable("plugin_relations", {
	pluginId: text("plugin_id").primaryKey(),
	related: text("related"), // JSON [{pluginId, similarity}], desc
	cluster: text("cluster"),
	influence: real("influence"),
	refreshedAt: text("refreshed_at"),
});

export const competitions = sqliteTable("competitions", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	announcedAt: text("announced_at").notNull(),
	announcementUrl: text("announcement_url").notNull(),
});

export const placements = sqliteTable(
	"placements",
	{
		competitionId: text("competition_id")
			.notNull()
			.references(() => competitions.id),
		pluginId: text("plugin_id").notNull(),
		place: integer("place").notNull(),
		prize: integer("prize"),
	},
	(t) => [index("placements_plugin_idx").on(t.pluginId)],
);

// meta: single-row counters maintained by the heavy poll, so request-time
// endpoints never full-scan a fact table (the snapshot count alone scans the
// whole plugin_snapshots table). key/value keeps future counters cheap.
export const meta = sqliteTable("meta", {
	key: text("key").primaryKey(),
	value: integer("value"),
});

// submission_events: every marketplace submission attempt, recorded once by
// GitHub issue number regardless of its eventual validation or publication.
export const submissionEvents = sqliteTable(
	"submission_events",
	{
		issueNumber: integer("issue_number").primaryKey(),
		kind: text("kind", { enum: ["plugin", "verification"] }).notNull(),
		occurredAt: text("occurred_at").notNull(),
	},
	(t) => [index("submission_events_time_idx").on(t.occurredAt)],
);

// verification_events: derived by diffing verificationStatus vs prior snapshot
export const verificationEvents = sqliteTable(
	"verification_events",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		pluginId: text("plugin_id").notNull(),
		occurredAt: text("occurred_at").notNull(),
		fromStatus: text("from_status"),
		toStatus: text("to_status"),
	},
	(t) => [
		index("verification_events_time_idx").on(t.occurredAt),
		index("verification_events_plugin_idx").on(t.pluginId),
	],
);

// update_events: derived by diffing version vs prior snapshot
export const updateEvents = sqliteTable(
	"update_events",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		pluginId: text("plugin_id").notNull(),
		occurredAt: text("occurred_at").notNull(),
		fromVersion: text("from_version"),
		toVersion: text("to_version"),
	},
	(t) => [index("update_events_time_idx").on(t.occurredAt), index("update_events_plugin_idx").on(t.pluginId)],
);
