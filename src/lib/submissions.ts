import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { meta, submissionEvents } from "@/db/schema";
import type {
	SubmissionKind,
	SubmissionStatsResponse,
	SubmissionTag,
	SubmissionWindow,
	SubmissionWindowKind,
} from "@/lib/api-types";
import type { DrizzleDb } from "@/lib/db";

export type SubmissionEvent = {
	issueNumber: number;
	kind: SubmissionKind;
	occurredAt: string;
	labels?: string[];
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const KINDS = ["plugin", "verification"] as const;
const SUBMISSION_CURSOR_KEY = "submission_sync_cursor";
const ISO_DATE = z.iso.datetime({ offset: true }).transform((value) => new Date(value).toISOString());

export const submissionIngestSchema = z
	.object({
		events: z
			.array(
				z.object({
					issueNumber: z.number().int().positive(),
					kind: z.enum(KINDS),
					occurredAt: ISO_DATE,
					labels: z.array(z.string().trim().min(1).max(100)).max(20).optional().default([]),
				}),
			)
			.max(500),
		cursor: ISO_DATE.optional(),
	})
	.strict();

export async function readSubmissionCursor(db: DrizzleDb) {
	const [row] = await db.select({ value: meta.value }).from(meta).where(eq(meta.key, SUBMISSION_CURSOR_KEY)).all();
	return row?.value == null ? null : new Date(row.value).toISOString();
}

export async function ingestSubmissions(
	db: DrizzleDb,
	input: z.input<typeof submissionIngestSchema>,
	purge: () => Promise<unknown>,
) {
	let inserted = 0;
	for (let index = 0; index < input.events.length; index += 30) {
		const rows = input.events.slice(index, index + 30).map((event) => ({
			...event,
			labels: JSON.stringify([...new Set(event.labels ?? [])]),
		}));
		inserted += (
			await db
				.insert(submissionEvents)
				.values(rows)
				.onConflictDoNothing({ target: submissionEvents.issueNumber })
				.returning({ issueNumber: submissionEvents.issueNumber })
				.all()
		).length;
	}
	if (input.cursor) {
		await db
			.insert(meta)
			.values({ key: SUBMISSION_CURSOR_KEY, value: Date.parse(input.cursor) })
			.onConflictDoUpdate({
				target: meta.key,
				set: { value: sql`max(coalesce(${meta.value}, 0), excluded.value)` },
			})
			.run();
	}
	if (inserted > 0) await purge();
	return { inserted, cursor: await readSubmissionCursor(db) };
}

export async function submissionStatsResponse(db: DrizzleDb, nowIso = new Date().toISOString()) {
	const [rows, syncedAt] = await Promise.all([
		db.select().from(submissionEvents).orderBy(asc(submissionEvents.occurredAt)).all(),
		readSubmissionCursor(db),
	]);
	const events: SubmissionEvent[] = rows.map(({ labels, ...event }) => ({
		...event,
		labels: parseLabels(labels),
	}));
	return Response.json(submissionStats(events, nowIso, syncedAt));
}

function parseLabels(value: string | null | undefined) {
	try {
		const labels = JSON.parse(value ?? "[]");
		return Array.isArray(labels) && labels.every((label) => typeof label === "string") ? labels : [];
	} catch {
		return [];
	}
}

function hourStart(timestamp: number) {
	const date = new Date(timestamp);
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours());
}

function dayStart(timestamp: number) {
	const date = new Date(timestamp);
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function pivotValue(values: number[], left: number, right: number): number {
	if (right - left < 5) {
		const group = values.slice(left, right + 1).sort((a, b) => a - b);
		return group[Math.floor(group.length / 2)];
	}
	const medians = [];
	for (let index = left; index <= right; index += 5) {
		const group = values.slice(index, Math.min(index + 5, right + 1)).sort((a, b) => a - b);
		medians.push(group[Math.floor(group.length / 2)]);
	}
	return select(medians, Math.floor(medians.length / 2));
}

function select(values: number[], target: number): number {
	let left = 0;
	let right = values.length - 1;
	while (left < right) {
		const pivot = pivotValue(values, left, right);
		let lower = left;
		let index = left;
		let upper = right;
		while (index <= upper) {
			if (values[index] < pivot) {
				[values[index], values[lower]] = [values[lower], values[index]];
				lower++;
				index++;
			} else if (values[index] > pivot) {
				[values[index], values[upper]] = [values[upper], values[index]];
				upper--;
			} else {
				index++;
			}
		}
		if (target < lower) right = lower - 1;
		else if (target > upper) left = upper + 1;
		else return values[target];
	}
	return values[left];
}

function gapStats(gaps: number[], total: number): SubmissionWindowKind {
	if (gaps.length === 0) return { total, medianGapMinutes: null, averageGapMinutes: null };
	const middle = Math.floor(gaps.length / 2);
	const median =
		gaps.length % 2 === 0
			? (select([...gaps], middle - 1) + select([...gaps], middle)) / 2
			: select([...gaps], middle);
	const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
	const round = (value: number) => Math.round(value * 100) / 100;
	return { total, medianGapMinutes: round(median), averageGapMinutes: round(average) };
}

function peak(buckets: Map<string, number>) {
	let result: { bucket: string; count: number } | null = null;
	for (const [bucket, count] of buckets) {
		if (!result || count > result.count || (count === result.count && bucket < result.bucket))
			result = { bucket, count };
	}
	return result;
}

export function submissionStats(
	events: SubmissionEvent[],
	nowIso = new Date().toISOString(),
	syncedAt: string | null = null,
): SubmissionStatsResponse {
	const now = Date.parse(nowIso);
	const hourlyStart = hourStart(now) - 23 * HOUR_MS;
	const dailyStart = dayStart(now) - 29 * DAY_MS;
	const hourlyPoints: SubmissionWindow["points"] = Array.from({ length: 24 }, (_, index) => ({
		bucket: new Date(hourlyStart + index * HOUR_MS).toISOString(),
		plugin: 0,
		verification: 0,
	}));
	const dailyPoints: SubmissionWindow["points"] = Array.from({ length: 30 }, (_, index) => ({
		bucket: new Date(dailyStart + index * DAY_MS).toISOString().slice(0, 10),
		plugin: 0,
		verification: 0,
	}));
	const hourlyGaps: Record<SubmissionKind, number[]> = { plugin: [], verification: [] };
	const dailyGaps: Record<SubmissionKind, number[]> = { plugin: [], verification: [] };
	const hourlyLast: Record<SubmissionKind, number | null> = { plugin: null, verification: null };
	const dailyLast: Record<SubmissionKind, number | null> = { plugin: null, verification: null };
	const hourlyTotals: Record<SubmissionKind, number> = { plugin: 0, verification: 0 };
	const dailyTotals: Record<SubmissionKind, number> = { plugin: 0, verification: 0 };
	const totals: Record<SubmissionKind, number> = { plugin: 0, verification: 0 };
	const verificationTags = new Map<string, number>();
	const hourPeaks: Record<SubmissionKind, Map<string, number>> = {
		plugin: new Map(),
		verification: new Map(),
	};
	const dayPeaks: Record<SubmissionKind, Map<string, number>> = {
		plugin: new Map(),
		verification: new Map(),
	};

	for (const event of events) {
		const timestamp = Date.parse(event.occurredAt);
		const hour = new Date(hourStart(timestamp)).toISOString();
		const day = new Date(dayStart(timestamp)).toISOString().slice(0, 10);
		totals[event.kind]++;
		if (event.kind === "verification") {
			for (const label of event.labels ?? []) verificationTags.set(label, (verificationTags.get(label) ?? 0) + 1);
		}
		hourPeaks[event.kind].set(hour, (hourPeaks[event.kind].get(hour) ?? 0) + 1);
		dayPeaks[event.kind].set(day, (dayPeaks[event.kind].get(day) ?? 0) + 1);
		if (timestamp > now) continue;
		if (timestamp >= hourlyStart) {
			hourlyPoints[Math.floor((timestamp - hourlyStart) / HOUR_MS)][event.kind]++;
			const previous = hourlyLast[event.kind];
			if (previous != null) hourlyGaps[event.kind].push((timestamp - previous) / 60_000);
			hourlyLast[event.kind] = timestamp;
			hourlyTotals[event.kind]++;
		}
		if (timestamp >= dailyStart) {
			dailyPoints[Math.floor((timestamp - dailyStart) / DAY_MS)][event.kind]++;
			const previous = dailyLast[event.kind];
			if (previous != null) dailyGaps[event.kind].push((timestamp - previous) / 60_000);
			dailyLast[event.kind] = timestamp;
			dailyTotals[event.kind]++;
		}
	}

	return {
		hourly: {
			points: hourlyPoints,
			plugin: gapStats(hourlyGaps.plugin, hourlyTotals.plugin),
			verification: gapStats(hourlyGaps.verification, hourlyTotals.verification),
		},
		daily: {
			points: dailyPoints,
			plugin: gapStats(dailyGaps.plugin, dailyTotals.plugin),
			verification: gapStats(dailyGaps.verification, dailyTotals.verification),
		},
		allTime: Object.fromEntries(
			KINDS.map((kind) => [
				kind,
				{ total: totals[kind], peakHour: peak(hourPeaks[kind]), peakDay: peak(dayPeaks[kind]) },
			]),
		) as SubmissionStatsResponse["allTime"],
		verificationTags: [...verificationTags]
			.map(([label, count]): SubmissionTag => ({ label, count }))
			.sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
		syncedAt,
	};
}
