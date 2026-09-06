/** @jsxImportSource react */

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { ErrorPage } from "@/components/error-page";
import { Graph, GraphBody, GraphRule as FigureRule } from "@/components/graph-frame/graph-frame";
import { GraphRule } from "@/components/graph-frame/graph-rule";
import { GraphPlot } from "@/components/graph-plot";
import { GraphStat } from "@/components/graph-stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { fmt, fmtDate, fmtMonthDay } from "@/lib/format";
import { HttpError, authorDetailQuery, authorsQuery } from "@/lib/queries";
import { pageHead } from "@/lib/site";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/authors/$authorId")({
	// Property order matters: `head` reads `loaderData`, so it must be declared
	// after `loader` for the type to flow through.
	loader: async ({ params: { authorId }, context: { queryClient } }) => {
		try {
			const [detail] = await Promise.all([
				queryClient.query({ ...authorDetailQuery(authorId), staleTime: "static" }),
				// The rank card indexes the full author leaderboard; shared with
				// the authors tab of /leaderboards, so one fetch serves both.
				queryClient.query({ ...authorsQuery(), staleTime: "static" }),
			]);
			return { author: detail.author };
		} catch (err) {
			// The author API answers 404 when the author has no catalog plugins.
			if (err instanceof HttpError && err.status === 404) throw notFound();
			throw err;
		}
	},
	head: ({ params, loaderData }) => {
		const author = loaderData?.author ?? params.authorId;
		return pageHead(
			`${author} Omarchy Plugins & Stats · Omagraph`,
			`Explore ${author}'s Omarchy plugins, catalog rank, categories, hearts, views, copies, and marketplace activity over the latest 90 days.`,
			`/authors/${encodeURIComponent(params.authorId)}`,
		);
	},
	notFoundComponent: () => {
		const { authorId } = Route.useParams();
		return (
			<ErrorPage
				code="404"
				title="Author not found"
				description={`No plugins by "${authorId}" exist in the Omarchy catalog.`}
			/>
		);
	},
	component: AuthorDetailPage,
});

function AuthorDetailPage() {
	const { authorId } = Route.useParams();
	const { data } = useSuspenseQuery(authorDetailQuery(authorId));
	const { data: authors } = useSuspenseQuery(authorsQuery());
	const rankOf = (name: string) => {
		const idx = authors.rows.findIndex((r) => r.author === name);
		return idx >= 0 ? idx + 1 : null;
	};

	const { author, totals, plugins } = data;
	// Manual-setup plugins aren't installed through the catalog, so copies are
	// never recorded for them; hide the copies total when none are tracked.
	const allManualSetup = plugins.every((p) => p.status === "Manual setup");
	// Facts for the [ DETAILS ] figure, derived from the author's plugin rows.
	const categories = [...new Set(plugins.map((p) => p.category).filter((c): c is string => Boolean(c)))];
	const kinds = [...new Set(plugins.map((p) => p.kind).filter((k): k is string => Boolean(k)))];
	const since = plugins.reduce<string | null>(
		(earliest, p) => (p.addedAt && (!earliest || p.addedAt < earliest) ? p.addedAt : earliest),
		null,
	);
	const statusCounts = new Map<string, number>();
	for (const p of plugins) {
		const status = p.status ?? "unknown";
		statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
	}
	const statusParts = [...statusCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([status, n]) => `${n} ${status.toLowerCase()}`);

	// Stable across renders: the chart entrance replays whenever the data
	// array identity changes, so keep the mapped series memoized.
	const activity = useMemo(
		() => ({
			labels: data.activity.map((point) => fmtMonthDay(point.snapshotAt)),
			hearts: data.activity.map((point) => point.hearts ?? 0),
			views: data.activity.map((point) => point.views ?? 0),
			copies: data.activity.map((point) => point.copies ?? 0),
		}),
		[data.activity],
	);

	return (
		<div className="flex flex-col gap-8">
			<div className="flex flex-wrap items-stretch gap-4">
				<Graph title="Details" className="min-w-0 flex-1">
					<GraphBody className="flex flex-col gap-5">
						<h1 className="text-balance font-heading text-2xl">{author}</h1>
						<FigureRule />
						<dl className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
							<div className="flex min-w-0 flex-col gap-1">
								<dt className="text-xs tracking-wide text-graph-muted uppercase">plugins</dt>
								<dd>{totals.plugins}</dd>
							</div>
							<div className="flex min-w-0 flex-col gap-1">
								<dt className="text-xs tracking-wide text-graph-muted uppercase">categories</dt>
								<dd className="truncate" title={categories.join(", ")}>
									{categories.length > 0 ? categories.join(" · ") : "—"}
								</dd>
							</div>
							<div className="flex min-w-0 flex-col gap-1">
								<dt className="text-xs tracking-wide text-graph-muted uppercase">top plugin</dt>
								<dd>
									<Link
										to="/plugins/$pluginId"
										params={{ pluginId: plugins[0].id }}
										title={plugins[0].id}
										className="block truncate text-muted-foreground hover:text-foreground hover:underline"
									>
										{plugins[0].name ?? plugins[0].id}
									</Link>
								</dd>
							</div>
							<div className="flex min-w-0 flex-col gap-1">
								<dt className="text-xs tracking-wide text-graph-muted uppercase">active since</dt>
								<dd>{since ? fmtDate(since) : "—"}</dd>
							</div>
							<div className="flex min-w-0 flex-col gap-1">
								<dt className="text-xs tracking-wide text-graph-muted uppercase">status</dt>
								<dd>{statusParts.length > 0 ? statusParts.join(" · ") : "—"}</dd>
							</div>
							<div className="flex min-w-0 flex-col gap-1">
								<dt className="text-xs tracking-wide text-graph-muted uppercase">kinds</dt>
								<dd className="truncate" title={kinds.join(", ")}>
									{kinds.length > 0 ? kinds.join(" · ") : "—"}
								</dd>
							</div>
						</dl>
					</GraphBody>
				</Graph>
				<Graph title="Rank" className="w-full sm:w-48">
					<GraphBody className="flex flex-col gap-3 px-5 py-5">
						<div className="flex flex-col gap-1.5">
							<p className="text-3xl tracking-tight tabular-nums sm:text-4xl">#{rankOf(author) ?? "—"}</p>
							<p className="text-graph-muted">current rank (hearts)</p>
						</div>
					</GraphBody>
				</Graph>
			</div>

			<GraphStat
				title="Totals"
				items={[
					{ value: fmt(totals.hearts), label: "hearts" },
					{ value: fmt(totals.views), label: "views" },
					...(allManualSetup ? [] : [{ value: fmt(totals.copies), label: "copies" }]),
				]}
			/>

			{activity.labels.length > 0 && (
				<div className="grid gap-6 lg:grid-cols-3">
					<GraphPlot
						title="Hearts"
						data={activity.hearts}
						labels={activity.labels}
						palette="duo"
						tone="category"
					/>
					<GraphPlot
						title="Views"
						data={activity.views}
						labels={activity.labels}
						palette="duo"
						tone="secondary"
					/>
					{allManualSetup ? (
						<Graph title="Copies" className="w-full">
							<GraphBody className="flex h-full flex-col items-center justify-center px-5 py-7 text-center sm:px-8">
								<p className="text-graph-muted">copies aren't tracked for manual-setup plugins</p>
							</GraphBody>
						</Graph>
					) : (
						<GraphPlot
							title="Copies"
							data={activity.copies}
							labels={activity.labels}
							palette="duo"
							tone="accent"
						/>
					)}
				</div>
			)}

			<GraphRule />

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Plugin</TableHead>
						<TableHead>Category</TableHead>
						<TableHead className="text-right">Hearts</TableHead>
						<TableHead className="text-right">Views</TableHead>
						<TableHead className="text-right">Copies</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{plugins.map((p) => (
						<TableRow key={p.id}>
							<TableCell className="font-medium">
								<Link
									to="/plugins/$pluginId"
									params={{ pluginId: p.id }}
									title={p.id}
									className="block max-w-56 truncate hover:underline"
								>
									{p.name ?? p.id}
								</Link>
							</TableCell>
							<TableCell className="text-muted-foreground">{p.category}</TableCell>
							<TableCell className="text-right font-mono tabular-nums">{fmt(p.hearts)}</TableCell>
							<TableCell className="text-right font-mono tabular-nums">{fmt(p.views)}</TableCell>
							<TableCell
								className={cn(
									"text-right font-mono tabular-nums",
									p.status === "Manual setup" && "text-muted-foreground",
								)}
							>
								{p.status === "Manual setup" ? (
									<span title="copies aren't tracked for manual-setup plugins">—</span>
								) : (
									fmt(p.copies)
								)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
