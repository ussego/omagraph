/** @jsxImportSource react */

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { GraphSpark } from "@/components/graph-spark";
import { TrendingTable } from "@/components/trending-table";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";

import type { LeaderboardRow } from "@/lib/api-types";
import { fmt } from "@/lib/format";
import { authorsQuery, leaderboardQuery, trendingQuery } from "@/lib/queries";
import { pageHead } from "@/lib/site";
import { cn } from "@/lib/utils";

const VALID_TABS = ["hearts", "views", "copies", "copies_per_view", "trending", "authors"] as const;
const LIMITS = [25, 50, 100] as const;
const DEFAULTS = { tab: "hearts", limit: 25, days: 7 } as const;

// Podium card styling, mirroring the competition podium in competitions.tsx:
// winner is tallest and centered (sm:order-2), runner-up on its left.
function podiumSize(place: number) {
	if (place === 1) return "min-h-52 sm:order-2";
	if (place === 2) return "min-h-44 sm:order-1";
	return "sm:order-3";
}

function placeTone(place: number) {
	if (place === 1) return "text-graph-accent";
	if (place === 2) return "text-graph-accent-2";
	return "text-graph-accent-3";
}

// Podium card tint: the place color at low alpha at rest, deepened on hover.
function placeCardTone(place: number) {
	if (place === 1) return "bg-graph-accent/10 hover:bg-graph-accent/20";
	if (place === 2) return "bg-graph-accent-2/10 hover:bg-graph-accent-2/20";
	return "bg-graph-accent-3/10 hover:bg-graph-accent-3/20";
}

// Zod v4 schema passed straight to validateSearch; `.catch` coerces garbage
// to the default instead of erroring the route. Tab, Top-N, and trending
// window live in the URL so leaderboard views are shareable.
const leaderboardsSearchSchema = z.object({
	tab: z.enum(VALID_TABS).default(DEFAULTS.tab).catch(DEFAULTS.tab),
	limit: z.number().int().min(10).max(100).default(DEFAULTS.limit).catch(DEFAULTS.limit),
	days: z
		.union([z.literal(7), z.literal(30)])
		.default(DEFAULTS.days)
		.catch(DEFAULTS.days),
});

export const Route = createFileRoute("/leaderboards")({
	head: () =>
		pageHead(
			"Omarchy Plugin Leaderboard · Omagraph",
			"Compare the top Omarchy plugins by hearts, views, copies, conversion, and recent growth, with rankings for plugin authors across the catalog.",
			"/leaderboards",
		),
	validateSearch: leaderboardsSearchSchema,
	search: { middlewares: [stripSearchParams(DEFAULTS)] },
	// Only the active tab's data is fetched; deps changes (tab/limit/days)
	// re-run the loader regardless of staleTime.
	loaderDeps: ({ search: { tab, limit, days } }) => ({ tab, limit, days }),
	loader: ({ deps, context: { queryClient } }) => {
		if (deps.tab === "trending") return queryClient.query({ ...trendingQuery(deps.days), staleTime: "static" });
		if (deps.tab === "authors") return queryClient.query({ ...authorsQuery(), staleTime: "static" });
		return queryClient.query({ ...leaderboardQuery(deps.tab, deps.limit, 10), staleTime: "static" });
	},
	component: LeaderboardsPage,
});

const METRIC_TABS = [
	{
		value: "hearts",
		label: "Hearts",
		tone: "category",

		score: (r: LeaderboardRow) => r.hearts,
		spark: (r: LeaderboardRow) => (r.spark ?? []).map((s) => s.hearts ?? 0),
	},
	{
		value: "views",
		label: "Views",
		tone: "secondary",

		score: (r: LeaderboardRow) => r.views,
		spark: (r: LeaderboardRow) => (r.spark ?? []).map((s) => s.views ?? 0),
	},
	{
		value: "copies",
		label: "Copies",
		tone: "accent",

		score: (r: LeaderboardRow) => r.copies,
		spark: (r: LeaderboardRow) => (r.spark ?? []).map((s) => s.copies ?? 0),
	},
	{
		value: "copies_per_view",
		label: "Conversion",
		tone: "positive",

		score: (r: LeaderboardRow) => r.score,
		spark: (r: LeaderboardRow) => (r.spark ?? []).map((s) => (s.views ? (s.copies ?? 0) / s.views : 0)),
	},
] as const;

function MetricLeaderboard({ metric }: { metric: (typeof METRIC_TABS)[number] }) {
	const { limit } = Route.useSearch();
	const navigate = useNavigate({ from: "/leaderboards" });
	const { data } = useSuspenseQuery(leaderboardQuery(metric.value, limit, 10));

	const rows = data.rows;
	// Podium shows the top three (which equal the global top three for any
	// limit ≥ 10), so the table picks up at rank 4 instead of repeating them.
	const podium = rows.slice(0, 3);
	const rest = rows.slice(3);

	return (
		<div className="flex flex-col gap-6">
			{podium.length > 0 && (
				<div className="grid items-end gap-3 sm:grid-cols-3">
					{podium.map((r, i) => {
						const place = i + 1;
						const name = r.name ?? r.pluginId;
						return (
							<Link
								key={r.pluginId}
								to="/plugins/$pluginId"
								params={{ pluginId: r.pluginId }}
								title={name}
								className={cn(
									"graph-frame relative flex min-h-36 flex-col justify-between gap-8 p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
									podiumSize(place),
									placeCardTone(place),
								)}
							>
								<div className="flex items-start justify-between gap-3">
									<span className={cn("font-mono text-4xl leading-none", placeTone(place))}>#{place}</span>
									<span className="font-mono text-sm text-graph-muted tabular-nums">{fmt(metric.score(r))}</span>
								</div>
								<div className="flex min-w-0 flex-col gap-1">
									<span className="line-clamp-2 text-base font-medium break-words">{name}</span>
									{r.author ? <span className="truncate text-xs text-graph-muted">{r.author}</span> : null}
								</div>
							</Link>
						);
					})}
				</div>
			)}
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-14">#</TableHead>
						<TableHead>Plugin</TableHead>
						<TableHead>Author</TableHead>
						<TableHead className="text-right">Value</TableHead>
						<TableHead className="w-36">Trend</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rest.map((r, i) => (
						<TableRow key={r.pluginId}>
							<TableCell className="font-mono tabular-nums">{i + 4}</TableCell>
							<TableCell>
								<Link
									to="/plugins/$pluginId"
									params={{ pluginId: r.pluginId }}
									title={r.name ?? r.pluginId}
									className="block max-w-64 truncate font-medium hover:underline"
								>
									{r.name ?? r.pluginId}
								</Link>
							</TableCell>
							<TableCell className="text-muted-foreground">
								{r.author ? (
									<Link
										to="/authors/$authorId"
										params={{ authorId: r.author }}
										className="hover:underline"
									>
										{r.author}
									</Link>
								) : (
									"—"
								)}
							</TableCell>
							<TableCell className="text-right font-mono tabular-nums">{fmt(metric.score(r))}</TableCell>
							<TableCell>
								{(r.spark?.length ?? 0) > 1 ? (
									<GraphSpark
										title=""
										data={metric.spark(r)}
										palette="duo"
										tone={metric.tone}
										corner=""
										className="w-32 bg-none"
										bodyClassName="px-0 py-0 sm:px-0 sm:py-0"
									/>
								) : (
									<span className="text-muted-foreground text-xs">—</span>
								)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			<TopLimitButtons limit={limit} onChange={(n) => navigate({ search: (prev) => ({ ...prev, limit: n }) })} />
		</div>
	);
}

function TopLimitButtons({ limit, onChange }: { limit: number; onChange: (n: (typeof LIMITS)[number]) => void }) {
	return (
		<div className="flex items-center justify-end gap-1">
			{LIMITS.map((n) => (
				<Button key={n} variant={limit === n ? "secondary" : "ghost"} size="sm" onClick={() => onChange(n)}>
					Top {n}
				</Button>
			))}
		</div>
	);
}

function TrendingLeaderboard() {
	const { days } = Route.useSearch();
	const navigate = useNavigate({ from: "/leaderboards" });
	const { data } = useSuspenseQuery(trendingQuery(days));

	return (
		<div className="flex flex-col gap-6">
			<Tabs
				value={String(days)}
				onValueChange={(v) => navigate({ search: (prev) => ({ ...prev, days: v === "30" ? 30 : 7 }) })}
			>
				<TabsList>
					<TabsTab value="7">7 days</TabsTab>
					<TabsTab value="30">30 days</TabsTab>
				</TabsList>
			</Tabs>
			<TrendingTable top={data.top} limit={10} />
		</div>
	);
}

function AuthorsLeaderboard() {
	const { limit } = Route.useSearch();
	const navigate = useNavigate({ from: "/leaderboards" });
	const { data } = useSuspenseQuery(authorsQuery());

	const rows = data.rows.slice(0, limit);
	const podium = rows.slice(0, 3);
	const rest = rows.slice(3);

	return (
		<div className="flex flex-col gap-6">
			{podium.length > 0 && (
				<div className="grid items-end gap-3 sm:grid-cols-3">
					{podium.map((r, i) => {
						const place = i + 1;
						return (
							<Link
								key={r.author}
								to="/authors/$authorId"
								params={{ authorId: r.author ?? "" }}
								className={cn(
									"graph-frame relative flex min-h-36 flex-col justify-between gap-8 p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
									podiumSize(place),
									placeCardTone(place),
								)}
							>
								<div className="flex items-start justify-between gap-3">
									<span className={cn("font-mono text-4xl leading-none", placeTone(place))}>#{place}</span>
									<span className="font-mono text-sm text-graph-muted tabular-nums">{fmt(r.hearts)}</span>
								</div>
								<div className="flex min-w-0 flex-col gap-1">
									<span className="truncate text-base font-medium">{r.author}</span>
									<span className="truncate text-xs text-graph-muted">{fmt(r.plugins)} plugins</span>
								</div>
							</Link>
						);
					})}
				</div>
			)}
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-14">#</TableHead>
						<TableHead>Author</TableHead>
						<TableHead className="text-right">Plugins</TableHead>
						<TableHead className="text-right">Hearts</TableHead>
						<TableHead className="text-right">Views</TableHead>
						<TableHead className="text-right">Copies</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rest.map((r, i) => (
						<TableRow key={r.author}>
							<TableCell className="font-mono tabular-nums">{i + 4}</TableCell>
							<TableCell className="font-medium">
								<Link
									to="/authors/$authorId"
									params={{ authorId: r.author ?? "" }}
									className="hover:underline"
								>
									{r.author}
								</Link>
							</TableCell>
							<TableCell className="text-right font-mono tabular-nums">{fmt(r.plugins)}</TableCell>
							<TableCell className="text-right font-mono tabular-nums">{fmt(r.hearts)}</TableCell>
							<TableCell className="text-right font-mono tabular-nums">{fmt(r.views)}</TableCell>
							<TableCell className="text-right font-mono tabular-nums">{fmt(r.copies)}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			<TopLimitButtons limit={limit} onChange={(n) => navigate({ search: (prev) => ({ ...prev, limit: n }) })} />
		</div>
	);
}

function LeaderboardsPage() {
	const { tab } = Route.useSearch();
	const navigate = useNavigate({ from: "/leaderboards" });
	const metric = METRIC_TABS.find((m) => m.value === tab);
	return (
		<div className="flex flex-col gap-6">
			<div className="flex max-w-2xl flex-col gap-1">
				<h1 className="font-heading text-2xl">Omarchy Plugin Leaderboard</h1>
				<p className="text-muted-foreground text-sm">
					Compare plugins and authors by marketplace activity, conversion, and recent growth.
				</p>
			</div>
			<Tabs
				value={tab}
				onValueChange={(value) => navigate({ search: (prev) => ({ ...prev, tab: value as typeof tab }) })}
			>
				<TabsList variant="underline">
					{METRIC_TABS.map((m) => (
						<TabsTab key={m.value} value={m.value}>
							{m.label}
						</TabsTab>
					))}
					<TabsTab value="trending">Trending</TabsTab>
					<TabsTab value="authors">Authors</TabsTab>
				</TabsList>
			</Tabs>
			{metric ? (
				<MetricLeaderboard metric={metric} />
			) : tab === "trending" ? (
				<TrendingLeaderboard />
			) : (
				<AuthorsLeaderboard />
			)}
		</div>
	);
}
