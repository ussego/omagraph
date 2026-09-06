/** @jsxImportSource react */

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import type { GraphTone } from "@/components/graph-frame/graph-frame";
import { GraphRule } from "@/components/graph-frame/graph-rule";
import { GraphPlot } from "@/components/graph-plot";
import { GraphStat } from "@/components/graph-stat";
import { TrendingTable } from "@/components/trending-table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";

import type { ChartSeriesResponse, StatsResponse } from "@/lib/api-types";
import { fmt, fmtMonthDay, fmtRelative, pct } from "@/lib/format";
import {
	breakdownQuery,
	type Granularity,
	healthQuery,
	recentPluginsQuery,
	statsQuery,
	trendingQuery,
	totalStatsQuery,
} from "@/lib/queries";
import { pageHead, SITE_DESC, SITE_TITLE, SITE_URL } from "@/lib/site";

const RANGES = [
	{ label: "30d", value: "30d" },
	{ label: "90d", value: "90d" },
	{ label: "365d", value: "365d" },
	{ label: "All", value: "all" },
] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULTS = { groupBy: "day", range: "90d" } as const;

// Zod v4 schema passed straight to validateSearch; `.catch` coerces garbage
// to the default instead of erroring the route. View state lives in the URL,
// so filtered overviews are shareable and back/forward restores them.
const indexSearchSchema = z.object({
	// ponytail: default "day" because the catalog only has ~1 day of stats yet;
	// switch to "month" once there's enough history to be useful.
	groupBy: z.enum(["day", "month", "year"]).default(DEFAULTS.groupBy).catch(DEFAULTS.groupBy),
	range: z.enum(["30d", "90d", "365d", "all"]).default(DEFAULTS.range).catch(DEFAULTS.range),
	from: z.string().regex(ISO_DATE).optional().catch(undefined),
	to: z.string().regex(ISO_DATE).optional().catch(undefined),
});

export const Route = createFileRoute("/")({
	head: () => ({
		...pageHead(SITE_TITLE, SITE_DESC, "/"),
		scripts: [
			{
				type: "application/ld+json",
				children: JSON.stringify({
					"@context": "https://schema.org",
					"@type": "WebSite",
					name: "Omagraph",
					url: SITE_URL,
				}),
			},
		],
	}),
	validateSearch: indexSearchSchema,
	search: { middlewares: [stripSearchParams(DEFAULTS)] },
	loaderDeps: ({ search: { range, groupBy, from, to } }) => ({ range, groupBy, from, to }),
	loader: ({ deps, context: { queryClient } }) => {
		// The week counter is pinned to the last seven days regardless of the
		// selected range. /api/health is uncached by design (ops monitors read
		// it directly); the dashboard fetching it per view is not a new D1 cost
		// — the browser already did exactly that on every page load.
		return Promise.all([
			queryClient.query({ ...healthQuery(), staleTime: "static" }),
			queryClient.query({ ...breakdownQuery(), staleTime: "static" }),
			queryClient.query({
				...statsQuery("published", { range: "7d", groupBy: "day" }),
				staleTime: "static",
			}),
			queryClient.query({ ...statsQuery("published", deps), staleTime: "static" }),
			queryClient.query({ ...statsQuery("verified", deps), staleTime: "static" }),
			queryClient.query({ ...statsQuery("updated", deps), staleTime: "static" }),
			queryClient.query({ ...totalStatsQuery(deps.groupBy), staleTime: "static" }),
			queryClient.query({ ...trendingQuery(7), staleTime: "static" }),
			queryClient.query({ ...recentPluginsQuery(8), staleTime: "static" }),
		]);
	},
	component: OverviewPage,
});

type TrendPoint = StatsResponse["points"][number] | ChartSeriesResponse["points"][number];

function TrendChart({ title, points, tone }: { title: string; points: TrendPoint[]; tone: GraphTone }) {
	// Keep the series identity stable while sibling queries settle so the graph
	// entrance does not replay on every page render.
	const values = useMemo(() => points.map((point) => point.count), [points]);
	const labels = useMemo(
		() => points.map((point) => fmtMonthDay("bucket" in point ? point.bucket : point.date)),
		[points],
	);
	return (
		<div className="flex min-w-0 flex-col gap-2">
			<GraphPlot title={title} data={values} labels={labels} palette="duo" tone={tone} className="w-full" />
		</div>
	);
}

function OverviewPage() {
	const { groupBy, range, from, to } = Route.useSearch();
	const navigate = useNavigate({ from: "/" });

	const { data: health } = useSuspenseQuery(healthQuery());
	const { data: breakdown } = useSuspenseQuery(breakdownQuery());
	const { data: publishedWeek } = useSuspenseQuery(statsQuery("published", { range: "7d", groupBy: "day" }));
	const { data: published } = useSuspenseQuery(statsQuery("published", { range, groupBy, from, to }));
	const { data: verified } = useSuspenseQuery(statsQuery("verified", { range, groupBy, from, to }));
	const { data: updated } = useSuspenseQuery(statsQuery("updated", { range, groupBy, from, to }));
	const { data: total } = useSuspenseQuery(totalStatsQuery(groupBy));
	const { data: trending } = useSuspenseQuery(trendingQuery(7));
	const { data: recent } = useSuspenseQuery(recentPluginsQuery(8));

	const weekCount = publishedWeek.points.reduce((a, p) => a + p.count, 0);
	const custom = Boolean(from || to);

	return (
		<div className="flex flex-col gap-8">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="flex max-w-2xl flex-col gap-1">
					<div className="flex flex-wrap items-baseline gap-x-3">
						<h1 className="font-heading text-2xl">Omarchy Plugin Stats &amp; Trends</h1>
						<p className="text-muted-foreground text-xs">
							last snapshot {fmtRelative(health.lastSnapshotAt)}
						</p>
					</div>
					<p className="text-muted-foreground text-sm">
						Track catalog growth, verification changes, updates, and marketplace activity across Omarchy
						plugins.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Tabs
						value={groupBy}
						onValueChange={(v) => navigate({ search: (prev) => ({ ...prev, groupBy: v as Granularity }) })}
					>
						<TabsList size="sm">
							<TabsTab value="day">Day</TabsTab>
							<TabsTab value="month">Month</TabsTab>
							<TabsTab value="year">Year</TabsTab>
						</TabsList>
					</Tabs>
					<span className="h-5 w-px bg-border" aria-hidden="true" />
					<Tabs
						value={range}
						onValueChange={(v) => {
							// A preset range supersedes any custom date selection.
							navigate({
								search: (prev) => ({
									...prev,
									range: v as (typeof RANGES)[number]["value"],
									from: undefined,
									to: undefined,
								}),
							});
						}}
					>
						<TabsList size="sm">
							{RANGES.map((r) => (
								<TabsTab key={r.value} value={r.value}>
									{r.label}
								</TabsTab>
							))}
						</TabsList>
					</Tabs>
					<Popover>
						<PopoverTrigger
							render={
								<Button
									variant={custom ? "secondary" : "ghost"}
									size="default"
									// Default height matches the sm tabs list's outer
									// height (h-6.5 items + p-0.5 list padding).
									className="graph-frame font-mono tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
								>
									Custom
								</Button>
							}
						/>
						<PopoverPopup align="end">
							<Calendar
								mode="range"
								selected={from && to ? { from: new Date(from), to: new Date(to) } : undefined}
								onSelect={(r) => {
									navigate({
										search: (prev) => ({
											...prev,
											from: r?.from ? r.from.toISOString().slice(0, 10) : undefined,
											to: r?.to ? r.to.toISOString().slice(0, 10) : undefined,
										}),
									});
								}}
							/>
							{custom && (
								<Button
									variant="ghost"
									size="sm"
									className="mt-2 w-full"
									onClick={() =>
										navigate({ search: (prev) => ({ ...prev, from: undefined, to: undefined }) })
									}
								>
									Clear dates
								</Button>
							)}
						</PopoverPopup>
					</Popover>
				</div>
			</div>

			<GraphStat
				title="Catalog"
				items={[
					{ tone: "accent", value: fmt(health.pluginCount), label: "total plugins" },
					{
						tone: "positive",
						value: `${pct(breakdown.verifiedCount, breakdown.totalPlugins)}%`,
						label: "verified",
					},
					{ tone: "category", value: fmt(weekCount), label: "published this week" },
					{ tone: "secondary", value: fmt(health.snapshotCount), label: "snapshots stored" },
				]}
			/>

			<div className="flex flex-col gap-8">
				<div className="grid gap-8 md:grid-cols-2">
					<TrendChart title="Published" points={published.points} tone="category" />
					<TrendChart title="Total" points={total.points} tone="accent" />
				</div>

				<div className="grid gap-8 md:grid-cols-2">
					<TrendChart title="Verified" points={verified.points} tone="positive" />
					<TrendChart title="Updated" points={updated.points} tone="secondary" />
				</div>
			</div>

			<GraphRule />

			<section className="flex flex-col gap-3">
				<div className="flex items-baseline justify-between">
					<h2 className="font-heading text-xl">Trending this week</h2>
					<Link
						to="/leaderboards"
						search={{ tab: "trending" }}
						className="text-muted-foreground text-sm hover:underline"
					>
						View all
					</Link>
				</div>
				<TrendingTable top={trending.top} />
			</section>

			<GraphRule />

			<div className="flex flex-col gap-3">
				<div className="flex items-baseline justify-between">
					<h2 className="font-heading text-xl">Recent plugins</h2>
				</div>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Plugin</TableHead>
							<TableHead>Author</TableHead>
							<TableHead>Category</TableHead>
							<TableHead className="text-right">Added</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{recent.plugins.map((p) => (
							<TableRow key={p.id}>
								<TableCell>
									<Link
										to="/plugins/$pluginId"
										params={{ pluginId: p.id }}
										title={p.name ?? p.id}
										className="block max-w-72 truncate font-medium hover:underline"
									>
										{p.name ?? p.id}
									</Link>
								</TableCell>
								<TableCell className="text-muted-foreground">
									{p.author ? (
										<Link
											to="/authors/$authorId"
											params={{ authorId: p.author }}
											title={p.author}
											className="block max-w-40 truncate hover:underline"
										>
											{p.author}
										</Link>
									) : (
										"—"
									)}
								</TableCell>
								<TableCell className="text-muted-foreground">{p.category ?? "—"}</TableCell>
								<TableCell className="text-right font-mono tabular-nums">
									{fmtRelative(p.addedAt)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
