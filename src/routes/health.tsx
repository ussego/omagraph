/** @jsxImportSource react */

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import type { GraphTone } from "@/components/graph-frame/graph-frame";
import { BrokenPluginsTable } from "@/components/broken-plugins-table";
import { GraphRule } from "@/components/graph-frame/graph-rule";
import { GraphPlot } from "@/components/graph-plot";
import { GraphRank } from "@/components/graph-rank";
import { GraphStat } from "@/components/graph-stat";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyTitle } from "@/components/ui/empty";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { UnverifiedPluginsTable } from "@/components/unverified-plugins-table";

import type { SubmissionKind, SubmissionStatsResponse } from "@/lib/api-types";
import { fmt, fmtDate, fmtDateTime, fmtMonthDay } from "@/lib/format";
import { breakdownQuery, brokenPluginsQuery, submissionStatsQuery, unverifiedPluginsQuery } from "@/lib/queries";
import { pageHead } from "@/lib/site";
import {
	type SubmissionPeriod,
	submissionPeriodSchema,
	submissionSyncPresentation,
	submissionWindow,
} from "@/lib/submission-view";

const RANGES = [
	{ value: "7d", label: "7d" },
	{ value: "14d", label: "14d" },
	{ value: "30d", label: "1 month" },
] as const;
const DEFAULTS = { range: "30d", page: 1, submissionPeriod: "hour" } as const;
const UNVERIFIED_PAGE_SIZE = 25;

function statusTone(status: string | null): GraphTone {
	const value = status?.toLowerCase() ?? "unknown";
	if (value === "verified" || value === "available" || value === "built in") return "positive";
	if (["broken", "failed", "error", "unavailable"].some((word) => value.includes(word))) return "negative";
	return "warning";
}

// Zod v4 schema passed straight to validateSearch; `.catch` coerces garbage
// to the default instead of erroring the route.
export const healthSearchSchema = z.object({
	range: z.enum(["7d", "14d", "30d"]).default(DEFAULTS.range).catch(DEFAULTS.range),
	page: z.number().int().positive().default(DEFAULTS.page).catch(DEFAULTS.page),
	submissionPeriod: submissionPeriodSchema,
});

export const Route = createFileRoute("/health")({
	head: () =>
		pageHead(
			"Omarchy Plugin Ecosystem Health · Omagraph",
			"Review verification status, install availability, stale repositories, failed upstream checks, and recently unverified plugins across the Omarchy catalog.",
			"/health",
		),
	validateSearch: healthSearchSchema,
	search: { middlewares: [stripSearchParams(DEFAULTS)] },
	loaderDeps: ({ search: { range } }) => ({ range }),
	loader: ({ deps, context: { queryClient } }) =>
		Promise.all([
			queryClient.query({ ...breakdownQuery(), staleTime: "static" }),
			queryClient.query({ ...brokenPluginsQuery(), staleTime: "static" }),
			queryClient.query({ ...unverifiedPluginsQuery(deps.range), staleTime: "static" }),
			queryClient.query({ ...submissionStatsQuery(), staleTime: "static" }),
		]),
	component: HealthPage,
});

function StatusChart({ title, rows }: { title: string; rows: { status: string | null; count: number }[] | undefined }) {
	const items = useMemo(
		() =>
			(rows ?? [])
				.map((row) => ({
					label: row.status ?? "unknown",
					value: row.count,
					tone: statusTone(row.status),
				}))
				.sort((left, right) => right.value - left.value),
		[rows],
	);
	if (items.length > 0) {
		return <GraphRank title={title} items={items} className="w-full" />;
	}
	return (
		<Empty>
			<EmptyTitle>No data</EmptyTitle>
		</Empty>
	);
}

function formatGap(minutes: number | null) {
	if (minutes == null) return "—";
	if (minutes < 60) return `${fmt(Math.round(minutes))}m`;
	if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`;
	return `${(minutes / 1440).toFixed(1)}d`;
}

function SubmissionKindCharts({
	kind,
	label,
	period,
	stats,
}: {
	kind: SubmissionKind;
	label: string;
	period: SubmissionPeriod;
	stats: SubmissionStatsResponse;
}) {
	const window = submissionWindow(stats, period);
	const current = window[kind];
	const allTime = stats.allTime[kind];
	const periodLabel = period === "hour" ? "Hourly · 24h" : "Daily · 30d";

	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<GraphPlot
				title={`${label.toUpperCase()} · ${periodLabel.toUpperCase()}`}
				data={window.points.map((point) => point[kind])}
				labels={window.points.map((point) => fmtMonthDay(point.bucket))}
				className="w-full"
			/>
			<GraphStat
				title={label.toUpperCase()}
				items={[
					{
						value: fmt(current.total),
						label: period === "hour" ? "received · 24h" : "received · 30d",
						hint: `${fmt(allTime.total)} all time`,
						tone: "accent",
					},
					{
						value: fmt(allTime.peakHour?.count),
						label: "all-time peak / hour",
						hint: allTime.peakHour ? `${fmtDateTime(allTime.peakHour.bucket)} UTC` : "No events yet",
					},
					{
						value: fmt(allTime.peakDay?.count),
						label: "all-time peak / day",
						hint: allTime.peakDay ? `${fmtDate(allTime.peakDay.bucket)} UTC` : "No events yet",
					},
					{
						value: formatGap(current.medianGapMinutes),
						label: "median arrival gap",
						hint: `Average ${formatGap(current.averageGapMinutes)}`,
					},
				]}
				className="w-full"
			/>
		</div>
	);
}

function SubmissionLoad({
	period,
	stats,
	onPeriodChange,
}: {
	period: SubmissionPeriod;
	stats: SubmissionStatsResponse;
	onPeriodChange: (period: SubmissionPeriod) => void;
}) {
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		const interval = window.setInterval(() => setNow(Date.now()), 60_000);
		return () => window.clearInterval(interval);
	}, []);
	const sync = submissionSyncPresentation(stats.syncedAt, now);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h2 className="font-heading text-xl">Submission load</h2>
					<p className="text-muted-foreground text-sm">
						Every received plugin submission and verification request, including attempts that were not
						validated or published.
					</p>
				</div>
				<div className="flex flex-wrap items-center justify-end gap-2">
					<Badge variant={sync.stale ? "warning" : "success"} className="rounded-none font-mono uppercase">
						{sync.label}
					</Badge>
					<Tabs value={period} onValueChange={(value) => onPeriodChange(value as SubmissionPeriod)}>
						<TabsList>
							<TabsTab value="hour">Hourly · 24h</TabsTab>
							<TabsTab value="day">Daily · 30d</TabsTab>
						</TabsList>
					</Tabs>
				</div>
			</div>
			<div className="flex flex-col gap-6">
				<SubmissionKindCharts kind="plugin" label="Plugin submissions" period={period} stats={stats} />
				<SubmissionKindCharts kind="verification" label="Verification requests" period={period} stats={stats} />
			</div>
		</div>
	);
}

function HealthPage() {
	const { range, page, submissionPeriod } = Route.useSearch();
	const navigate = useNavigate({ from: "/health" });
	const { data: breakdown } = useSuspenseQuery(breakdownQuery());
	const { data: broken } = useSuspenseQuery(brokenPluginsQuery());
	const { data: unverified } = useSuspenseQuery(unverifiedPluginsQuery(range));
	const { data: submissions } = useSuspenseQuery(submissionStatsQuery());
	const pageCount = Math.max(1, Math.ceil(unverified.plugins.length / UNVERIFIED_PAGE_SIZE));
	const currentPage = Math.min(page, pageCount);
	const pageStart = (currentPage - 1) * UNVERIFIED_PAGE_SIZE;
	const pagePlugins = unverified.plugins.slice(pageStart, pageStart + UNVERIFIED_PAGE_SIZE);

	return (
		<div className="flex flex-col gap-8">
			<div className="flex max-w-2xl flex-col gap-1">
				<h1 className="font-heading text-2xl">Omarchy Plugin Ecosystem Health</h1>
				<p className="text-muted-foreground text-sm">
					Review catalog verification, install availability, repository freshness, and upstream failures.
				</p>
			</div>

			<div className="flex flex-col gap-12">
				<StatusChart title="INSTALL AVAILABILITY" rows={breakdown.installStatus} />
				<StatusChart title="VERIFICATION STATUS" rows={breakdown.verification} />
				<SubmissionLoad
					period={submissionPeriod}
					stats={submissions}
					onPeriodChange={(period) =>
						navigate({ resetScroll: false, search: (prev) => ({ ...prev, submissionPeriod: period }) })
					}
				/>
			</div>

			<GraphRule />

			<div className="flex flex-col gap-3">
				<h2 className="font-heading text-xl">Broken plugins</h2>
				<p className="text-muted-foreground text-sm">
					Unreachable/failed upstream, or repository untouched for &gt;{broken.staleDays} days
				</p>
				<BrokenPluginsTable plugins={broken.plugins} />
			</div>

			<GraphRule />

			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<h2 className="font-heading text-xl">Unverified plugins</h2>
					<Tabs
						value={range}
						onValueChange={(v) =>
							navigate({ search: (prev) => ({ ...prev, range: v as typeof range, page: DEFAULTS.page }) })
						}
					>
						<TabsList>
							{RANGES.map((r) => (
								<TabsTab key={r.value} value={r.value}>
									{r.label}
								</TabsTab>
							))}
						</TabsList>
					</Tabs>
				</div>
				<UnverifiedPluginsTable plugins={pagePlugins} />
				{unverified.plugins.length > UNVERIFIED_PAGE_SIZE ? (
					<div className="flex flex-col items-center gap-2">
						<p className="font-mono text-muted-foreground text-xs uppercase tabular-nums">
							Showing {pageStart + 1}–
							{Math.min(pageStart + UNVERIFIED_PAGE_SIZE, unverified.plugins.length)} of{" "}
							{unverified.plugins.length}
						</p>
						<Pagination>
							<PaginationContent>
								<PaginationItem>
									{currentPage > 1 ? (
										<PaginationPrevious
											className={buttonVariants({ variant: "ghost", size: "default" })}
											render={
												<Link
													from="/health"
													resetScroll={false}
													to="/health"
													search={(prev) => ({ ...prev, page: currentPage - 1 })}
												/>
											}
										/>
									) : (
										<PaginationPrevious aria-disabled className="pointer-events-none opacity-50" />
									)}
								</PaginationItem>
								<PaginationItem>
									<span className="flex h-8 items-center px-2 font-mono text-xs uppercase tabular-nums">
										Page {currentPage} of {pageCount}
									</span>
								</PaginationItem>
								<PaginationItem>
									{currentPage < pageCount ? (
										<PaginationNext
											className={buttonVariants({ variant: "ghost", size: "default" })}
											render={
												<Link
													from="/health"
													resetScroll={false}
													to="/health"
													search={(prev) => ({ ...prev, page: currentPage + 1 })}
												/>
											}
										/>
									) : (
										<PaginationNext aria-disabled className="pointer-events-none opacity-50" />
									)}
								</PaginationItem>
							</PaginationContent>
						</Pagination>
					</div>
				) : null}
			</div>
		</div>
	);
}
