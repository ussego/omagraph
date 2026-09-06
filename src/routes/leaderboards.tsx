/** @jsxImportSource react */

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import { GraphRank } from "@/components/graph-rank";
import { GraphSpark } from "@/components/graph-spark";
import { TrendingTable } from "@/components/trending-table";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";

import type { LeaderboardRow } from "@/lib/api-types";
import { fmt } from "@/lib/format";
import { authorsQuery, leaderboardQuery, trendingQuery } from "@/lib/queries";
import { pageHead } from "@/lib/site";

const VALID_TABS = ["hearts", "views", "copies", "copies_per_view", "trending", "authors"] as const;
const LIMITS = [25, 50, 100] as const;
const DEFAULTS = { tab: "hearts", limit: 25, days: 7 } as const;

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
	// Stable across renders: the rank entrance replays whenever the data array
	// identity changes, and this map would otherwise make a fresh array on
	// every re-render. Disambiguate the label by author when multiple plugins
	// share a name (e.g. three plugins all named "Notification Center"); the
	// upstream GraphRank keys by label, so collisions would otherwise warn.
	const chartRows = useMemo(
		() =>
			rows.map((r, _i, all) => {
				const name = r.name ?? r.pluginId;
				const sameNameCount = all.filter((other) => (other.name ?? other.pluginId) === name).length;
				const showAuthor = sameNameCount > 1 && r.author;
				return {
					label: showAuthor ? `${name} · ${r.author}` : name,
					value: metric.score(r) ?? 0,
				};
			}),
		[rows, metric],
	);

	return (
		<div className="flex flex-col gap-6">
			<GraphRank title={metric.label} items={chartRows} tone={metric.tone} />
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
					{rows.map((r, i) => (
						<TableRow key={r.pluginId}>
							<TableCell className="font-mono tabular-nums">{i + 1}</TableCell>
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
	const rankItems = rows.map((row) => ({
		label: row.author ?? "(unknown)",
		value: row.hearts ?? 0,
		display: fmt(row.hearts),
	}));

	return (
		<div className="flex flex-col gap-6">
			<GraphRank title="AUTHOR HEARTS" items={rankItems} tone="category" />
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
					{rows.map((r, i) => (
						<TableRow key={r.author}>
							<TableCell className="font-mono tabular-nums">{i + 1}</TableCell>
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
