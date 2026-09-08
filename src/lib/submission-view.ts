import { z } from "zod";

import type { SubmissionStatsResponse } from "@/lib/api-types";
import { fmtDateTime } from "@/lib/format";

export const submissionPeriodSchema = z.enum(["hour", "day"]).default("hour").catch("hour");

export type SubmissionPeriod = z.infer<typeof submissionPeriodSchema>;

export const submissionWindow = (stats: SubmissionStatsResponse, period: SubmissionPeriod) =>
	period === "hour" ? stats.hourly : stats.daily;

export const submissionSyncIsStale = (syncedAt: string | null, now = Date.now()) =>
	!syncedAt || now - Date.parse(syncedAt) > 15 * 60_000;

export function submissionSyncPresentation(syncedAt: string | null, now = Date.now()) {
	const stale = submissionSyncIsStale(syncedAt, now);
	if (!syncedAt) return { stale, label: "Submission sync pending" };
	return {
		stale,
		label: `${stale ? "Stale · last synced" : "Last synced"} ${fmtDateTime(syncedAt)} UTC`,
	};
}
