/** @jsxImportSource react */

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ErrorPage } from "@/components/error-page";
import { GraphRule as FigureRule, Graph, GraphBody } from "@/components/graph-frame/graph-frame";
import { GraphRule } from "@/components/graph-frame/graph-rule";
import { GraphPlot } from "@/components/graph-plot";
import { GraphStat } from "@/components/graph-stat";
import { EMBED_STATS, EmbedDialog } from "@/components/embed-dialog";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyTitle } from "@/components/ui/empty";
import { fmt, fmtDate, fmtMonthDay } from "@/lib/format";
import { HttpError, leaderboardQuery, pluginDetailQuery } from "@/lib/queries";
import { pageHead } from "@/lib/site";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/plugins/$pluginId")({
	// Property order matters: `head` reads `loaderData`, so it must be declared
	// after `loader` for the type to flow through.
	loader: async ({ params: { pluginId }, context: { queryClient } }) => {
		try {
			const [detail] = await Promise.all([
				queryClient.query({ ...pluginDetailQuery(pluginId), staleTime: "static" }),
				// The rank card reads the hearts leaderboard; shared across all
				// plugin pages, so one fetch serves every visit within its TTL.
				queryClient.query({ ...leaderboardQuery("hearts", 100, 0), staleTime: "static" }),
			]);
			return { name: detail.plugin.name ?? pluginId, description: detail.plugin.description };
		} catch (err) {
			// A 404 from the detail API means the plugin isn't in the catalog —
			// the same dead-end as an unmatched URL. Anything else (5xx, network)
			// is a load failure, not a missing plugin.
			if (err instanceof HttpError && err.status === 404) throw notFound();
			throw err;
		}
	},
	head: ({ params, loaderData }) => {
		const name = loaderData?.name ?? params.pluginId;
		const description =
			loaderData?.description ??
			`See hearts, views, copies, repository status, related plugins, and 90-day snapshot history for ${name} in the Omarchy plugin catalog.`;
		return pageHead(
			`${name} Stats & History · Omagraph`,
			description,
			`/plugins/${encodeURIComponent(params.pluginId)}`,
			false,
			`/og/plugins/${encodeURIComponent(params.pluginId)}.png`,
		);
	},
	notFoundComponent: () => {
		const { pluginId } = Route.useParams();
		return (
			<ErrorPage
				code="404"
				title="Plugin not found"
				description={`No plugin with the id "${pluginId}" exists in the Omarchy catalog.`}
			/>
		);
	},
	component: PluginDetailPage,
});

function verificationVariant(status: string | null): "success" | "warning" | "secondary" {
	if (status === "verified") return "success";
	if (status === "unverified") return "warning";
	return "secondary";
}

function statusVariant(status: string | null): "success" | "warning" | "secondary" {
	if (status === "Available") return "success";
	if (status === "Manual setup") return "warning";
	return "secondary";
}

function badgeSnippet(stat: (typeof EMBED_STATS)[number], pluginId: string) {
	const badge = `https://stats.ussego.com/api/badges/${stat}/${pluginId}.svg`;
	return `[![${stat}](${badge})](https://stats.ussego.com/plugins/${pluginId})`;
}

function winnerSnippet(pluginId: string) {
	const badge = `https://stats.ussego.com/api/badges/winner/${pluginId}.svg`;
	return `[![winner](${badge})](https://stats.ussego.com/plugins/${pluginId})`;
}

function ordinal(place: number): string {
	const mod100 = place % 100;
	if (mod100 >= 11 && mod100 <= 13) return `${place}th`;
	switch (place % 10) {
		case 1:
			return `${place}st`;
		case 2:
			return `${place}nd`;
		case 3:
			return `${place}rd`;
		default:
			return `${place}th`;
	}
}

function placeTone(place: number) {
	if (place === 1) return "text-graph-accent";
	if (place === 2) return "text-graph-accent-2";
	if (place === 0) return "text-graph-muted";
	return "text-graph-accent-3";
}

function placeCardTone(place: number) {
	if (place === 1) return "bg-graph-accent/10";
	if (place === 2) return "bg-graph-accent-2/10";
	if (place === 0) return "bg-muted/40";
	return "bg-graph-accent-3/10";
}

function placeGraphTone(place: number) {
	if (place === 1) return "accent";
	if (place === 2) return "secondary";
	if (place === 0) return undefined;
	return "category";
}

function PluginDetailPage() {
	const { pluginId } = Route.useParams();
	const { data } = useSuspenseQuery(pluginDetailQuery(pluginId));
	const { data: ranks } = useSuspenseQuery(leaderboardQuery("hearts", 100, 0));
	const rankOf = (id: string) => {
		const idx = ranks.rows.findIndex((r) => r.pluginId === id);
		return idx >= 0 ? idx + 1 : null;
	};

	// Clamp the description to 3 lines; show the toggle only while the text is
	// actually clipped (the clamp threshold varies with width, so measure it).
	const [descExpanded, setDescExpanded] = useState(false);
	const [descClamped, setDescClamped] = useState(false);
	const descRef = useRef<HTMLParagraphElement>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the description mounts — the ref is null during the loading skeleton, so the observer can't attach until data lands.
	useLayoutEffect(() => {
		const el = descRef.current;
		if (!el) return;
		const check = () => setDescClamped(el.scrollHeight > el.clientHeight + 1);
		check();
		const ro = new ResizeObserver(check);
		ro.observe(el);
		return () => ro.disconnect();
	}, [data.plugin.description]);

	const { plugin, snapshots, averages, relations } = data;
	const last = snapshots[snapshots.length - 1];
	// Manual-setup plugins aren't installed through the catalog, so the feed
	// never records copies for them — don't draw an all-zero Copies plot.
	const manualSetup = plugin.status === "Manual setup";
	const embedSnippets = [
		...EMBED_STATS.map((stat) => ({ label: stat, text: badgeSnippet(stat, plugin.id) })),
		...(data.placements.length > 0 ? [{ label: "winner", text: winnerSnippet(plugin.id) }] : []),
	];

	// Stable across renders: the chart's entrance replays whenever the data
	// array identity changes, and this map would otherwise make a fresh array
	// on every re-render of the page.
	const rows = useMemo(
		() =>
			snapshots.map((s) => ({
				snapshotAt: s.snapshotAt,
				hearts: s.hearts ?? 0,
				views: s.views ?? 0,
				copies: s.copies ?? 0,
			})),
		[snapshots],
	);
	const placement = data.placements[0];

	return (
		<div className="flex flex-col gap-8">
			{data.placements.length > 0 && (
				<Graph title="Competition" tone={placeGraphTone(placement.place)} className="w-full">
					<GraphBody className="grid !p-0 md:grid-cols-[14rem_minmax(0,1fr)]">
						<div
							className={cn(
								"relative flex min-h-48 flex-col items-center justify-center overflow-hidden px-5 py-7 sm:px-8 sm:py-8 md:min-h-full",
								placeCardTone(placement.place),
								placeTone(placement.place),
							)}
						>
							<span
								aria-hidden="true"
								className="absolute -right-2 -bottom-7 font-mono text-8xl leading-none opacity-10 select-none"
							>
								{placement.place === 0 ? "HM" : String(placement.place).padStart(2, "0")}
							</span>
							<strong className="relative font-mono text-6xl tracking-tighter tabular-nums">
								{placement.place === 0 ? "HM" : `#${placement.place}`}
							</strong>
							<span className="relative mt-2 font-mono text-xs tracking-[0.2em] uppercase">
								{placement.place === 0
									? "recognized"
									: placement.place === 1
										? "overall winner"
										: `${ordinal(placement.place)} place`}
							</span>
						</div>

						<div className="flex min-w-0 flex-col justify-between gap-6 px-5 py-7 sm:px-8 sm:py-8">
							<div className="flex flex-col gap-2">
								<p
									className={cn(
										"font-mono text-xs tracking-wide uppercase",
										placeTone(placement.place),
									)}
								>
									Awarded {fmtDate(placement.announcedAt)}
								</p>
								<h2 className="text-balance font-heading text-2xl sm:text-3xl">{placement.title}</h2>
								<p className="text-muted-foreground">
									{placement.place === 0
										? "Selected for an honorable mention."
										: `Placed ${ordinal(placement.place)} in the competition.`}
								</p>
							</div>

							<div className="flex flex-wrap items-end justify-between gap-5">
								<dl className="flex gap-8">
									<div className="flex flex-col gap-1">
										<dt className="font-mono text-xs text-graph-muted uppercase">placement</dt>
										<dd className="text-lg tabular-nums">
											{placement.place === 0 ? "Honorable mention" : ordinal(placement.place)}
										</dd>
									</div>
									{placement.prize != null && (
										<div className="flex flex-col gap-1">
											<dt className="font-mono text-xs text-graph-muted uppercase">prize</dt>
											<dd className={cn("text-lg tabular-nums", placeTone(placement.place))}>
												${fmt(placement.prize)}
											</dd>
										</div>
									)}
								</dl>
								<div className="flex flex-wrap gap-3 font-mono text-xs uppercase">
									<a
										href={placement.announcementUrl}
										target="_blank"
										rel="noreferrer"
										className={cn("hover:underline", placeTone(placement.place))}
									>
										announcement ↗
									</a>
									<Link
										to="/competitions"
										className="text-muted-foreground hover:text-foreground hover:underline"
									>
										hall of fame
									</Link>
								</div>
							</div>
						</div>
					</GraphBody>
				</Graph>
			)}
			<div className="flex flex-wrap items-stretch gap-4">
				<Graph title="Details" className="min-w-0 flex-1">
					<GraphBody className="flex flex-col gap-5">
						<div className="flex flex-col gap-2">
							<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
								<h1 className="text-balance font-heading text-2xl">{plugin.name ?? plugin.id}</h1>
								<p className="break-all font-mono text-xs tracking-wide text-graph-muted">{plugin.id}</p>
							</div>
							<p
								ref={descRef}
								className={cn(
									"max-w-2xl text-pretty text-muted-foreground text-sm",
									!descExpanded && "line-clamp-3",
								)}
							>
								{plugin.description}
							</p>
							{(descClamped || descExpanded) && (
								<button
									type="button"
									onClick={() => setDescExpanded((e) => !e)}
									aria-expanded={descExpanded}
									className="w-fit cursor-pointer text-muted-foreground text-xs underline decoration-dotted underline-offset-2 hover:text-foreground"
								>
									{descExpanded ? "Show less" : "Show more"}
								</button>
							)}
						</div>
						<FigureRule />
						<dl className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
							<div className="flex min-w-0 flex-col gap-1">
								<dt className="text-xs tracking-wide text-graph-muted uppercase">author</dt>
								<dd>
									{plugin.author ? (
										<Link
											to="/authors/$authorId"
											params={{ authorId: plugin.author }}
											className="text-muted-foreground hover:text-foreground hover:underline"
										>
											{plugin.author}
										</Link>
									) : (
										"—"
									)}
								</dd>
							</div>
							<div className="flex min-w-0 flex-col gap-1">
								<dt className="text-xs tracking-wide text-graph-muted uppercase">category</dt>
								<dd>{plugin.category ?? "—"}</dd>
							</div>
							<div className="flex min-w-0 flex-col gap-1">
								<dt className="text-xs tracking-wide text-graph-muted uppercase">added</dt>
								<dd>{fmtDate(plugin.addedAt)}</dd>
							</div>
							<div className="flex min-w-0 flex-col gap-1">
								<dt className="text-xs tracking-wide text-graph-muted uppercase">status</dt>
								<dd className="flex flex-wrap items-center gap-1.5">
									<Badge
										variant={verificationVariant(last?.verificationStatus ?? null)}
										className="font-mono uppercase"
									>
										{last?.verificationStatus ?? "unknown"}
									</Badge>
									{plugin.status && (
										<Badge variant={statusVariant(plugin.status)} className="font-mono uppercase">
											{plugin.status}
										</Badge>
									)}
								</dd>
							</div>
							<div className="flex min-w-0 flex-col gap-1">
								<dt className="text-xs tracking-wide text-graph-muted uppercase">family</dt>
								<dd>{relations?.cluster ?? "—"}</dd>
							</div>
							<div className="flex min-w-0 flex-col gap-1">
								<dt className="text-xs tracking-wide text-graph-muted uppercase">influence</dt>
								<dd title="graph influence in the omarchy explorer similarity graph">
									{typeof relations?.influence === "number" ? relations.influence.toFixed(1) : "—"}
								</dd>
							</div>
						</dl>
					</GraphBody>
				</Graph>
				<Graph title="Rank" className="w-full sm:w-56">
					<GraphBody className="flex flex-col gap-3 px-5 py-5">
						<div className="flex flex-col gap-1.5">
							<p className="text-3xl tracking-tight tabular-nums sm:text-4xl">
								#{rankOf(plugin.id) ?? "—"}
							</p>
							<p className="text-graph-muted">current rank (hearts)</p>
						</div>
						<FigureRule />
						<div className="flex flex-col items-start gap-3">
							<a
								href={`https://plugins.omarchy.org/plugin.html?id=${plugin.id}`}
								target="_blank"
								rel="noreferrer"
								className="font-mono text-xs tracking-wide text-graph-accent uppercase transition-colors hover:text-foreground"
							>
								omarchy plugins ↗
							</a>
							{plugin.repo && (
								<a
									href={plugin.repo}
									target="_blank"
									rel="noreferrer"
									className="font-mono text-xs tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
								>
									github{typeof plugin.stars === "number" ? ` · ${fmt(plugin.stars)} ★` : ""}
								</a>
							)}
							<EmbedDialog
								id={plugin.id}
								snippets={embedSnippets}
								disabled={snapshots.length === 0}
								disabledReason="No snapshots yet — badges appear after the next poll"
							/>
						</div>
					</GraphBody>
				</Graph>
			</div>

			{snapshots.length > 0 ? (
				<div className="grid gap-6 lg:grid-cols-3">
					<GraphPlot
						title="Hearts"
						data={rows.map((row) => row.hearts)}
						labels={rows.map((row) => fmtMonthDay(row.snapshotAt))}
						palette="duo"
						tone="category"
					/>
					<GraphPlot
						title="Views"
						data={rows.map((row) => row.views)}
						labels={rows.map((row) => fmtMonthDay(row.snapshotAt))}
						palette="duo"
						tone="secondary"
					/>
					{manualSetup ? (
						<Graph title="Copies" className="w-full">
							<GraphBody className="flex h-full flex-col items-center justify-center px-5 py-7 text-center sm:px-8">
								<p className="text-graph-muted">copies aren't tracked for manual-setup plugins</p>
							</GraphBody>
						</Graph>
					) : (
						<GraphPlot
							title="Copies"
							data={rows.map((row) => row.copies)}
							labels={rows.map((row) => fmtMonthDay(row.snapshotAt))}
							palette="duo"
							tone="accent"
						/>
					)}
				</div>
			) : (
				<Empty>
					<EmptyTitle>No snapshots yet. Stats appear after the next poll.</EmptyTitle>
				</Empty>
			)}

			<GraphRule />

			<GraphStat
				title="Averages"
				items={[
					{ value: fmt(averages.hearts), label: "average hearts" },
					{ value: fmt(averages.views), label: "average views" },
					...(manualSetup ? [] : [{ value: fmt(averages.copies), label: "average copies" }]),
				]}
			/>

			<GraphRule />

			{relations?.related.length ? (
				<Graph title="Related" className="w-full">
					<GraphBody className="flex flex-col gap-5">
						<p className="text-xs text-graph-muted">
							nearest neighbors by description similarity, from the omarchy explorer
						</p>
						<ul className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
							{relations.related.slice(0, 8).map((r) => (
								<li key={r.pluginId} className="flex min-w-0 flex-col gap-1">
									<Link
										to="/plugins/$pluginId"
										params={{ pluginId: r.pluginId }}
										title={`${r.name ?? r.pluginId} · ${Math.round(r.similarity * 100)}% similar`}
										className="truncate font-medium hover:underline"
									>
										{r.name ?? r.pluginId}
									</Link>
									<div className="flex items-baseline justify-between gap-3">
										<span className="truncate text-xs text-muted-foreground">
											{r.author ?? "—"}
										</span>
										<span className="font-mono text-xs text-graph-muted tabular-nums">
											{Math.round(r.similarity * 100)}%
										</span>
									</div>
								</li>
							))}
						</ul>
					</GraphBody>
				</Graph>
			) : (
				<Graph title="Related" className="w-full">
					<GraphBody className="flex flex-col items-center justify-center px-5 py-7 text-center sm:px-8">
						<p className="text-graph-muted">no related plugins yet</p>
					</GraphBody>
				</Graph>
			)}
		</div>
	);
}
