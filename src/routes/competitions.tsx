/** @jsxImportSource react */
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Graph, GraphBody, GraphRule } from "@/components/graph-frame/graph-frame";
import type { CompetitionsResponse } from "@/lib/api-types";
import { fmtDate } from "@/lib/format";
import { competitionsQuery } from "@/lib/queries";
import { pageHead } from "@/lib/site";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/competitions")({
	loader: ({ context: { queryClient } }) => queryClient.query({ ...competitionsQuery(), staleTime: "static" }),
	head: () => pageHead("Competitions · Omagraph", "Upcoming and completed Omarchy plugin competitions.", "/competitions"),
	component: CompetitionsPage,
});

type Placement = CompetitionsResponse["competitions"][number]["placements"][number];

// Temporary announcement until the next competition has real API-backed details.
const UPCOMING_COMPETITION = {
	announcementUrl: "https://x.com/dhh/status/2094688715893354690",
	message:
		"The next Omarchy plugin competition is going to be much, much bigger. We'll have a $10,000 prize pool. Way more winners. Way better voting. EVERYTHING IS ELIGIBLE (minus previous winners). Will announce full details within two weeks when Omacom Foundation is fully set up.",
} as const;

function placementName(placement: Placement) {
	return placement.name ?? placement.pluginId;
}

function prizeLabel(prize: number | null) {
	return prize == null ? null : `$${prize.toLocaleString("en-US")}`;
}

function placeTone(place: number) {
	if (place === 1) return "text-graph-accent";
	if (place === 2) return "text-graph-accent-2";
	return "text-graph-accent-3";
}

function placeHoverTone(place: number) {
	if (place === 1) return "hover:bg-graph-accent/10";
	if (place === 2) return "hover:bg-graph-accent-2/10";
	return "hover:bg-graph-accent-3/10";
}

function PlacementLink({ placement, className }: { placement: Placement; className?: string }) {
	return (
		<Link
			to="/plugins/$pluginId"
			params={{ pluginId: placement.pluginId }}
			className={cn("min-w-0 truncate hover:text-graph-accent hover:underline", className)}
		>
			{placementName(placement)}
		</Link>
	);
}

function CompetitionPlacements({ placements }: { placements: Placement[] }) {
	const ranked = placements.filter((placement) => placement.place > 0).sort((a, b) => a.place - b.place);
	const podium = ranked.slice(0, 3);
	const otherRanked = ranked.slice(3);
	const honorable = placements.filter((placement) => placement.place === 0);

	return (
		<div className="flex flex-col gap-6">
			{podium.length > 0 && (
				<div className="grid items-end gap-3 sm:grid-cols-3">
					{podium.map((placement) => {
						const placeName = placement.place === 1 ? "winner" : placement.place === 2 ? "runner-up" : "third place";

						return (
							<Link
								key={placement.pluginId}
								to="/plugins/$pluginId"
								params={{ pluginId: placement.pluginId }}
								className={cn(
									"graph-frame relative flex min-h-36 flex-col justify-between gap-8 p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
									placement.place === 1 && "min-h-52",
									placement.place === 2 && "min-h-44",
									placeHoverTone(placement.place),
								)}
							>
								<div className="flex items-start justify-between gap-3">
									<span className={cn("font-mono text-4xl leading-none", placeTone(placement.place))}>
										#{placement.place}
									</span>
									{prizeLabel(placement.prize) ? (
										<span className="font-mono text-sm text-graph-muted tabular-nums">
											{prizeLabel(placement.prize)}
										</span>
									) : null}
								</div>
								<div className="flex min-w-0 flex-col gap-1">
									<span className="truncate text-base font-medium">{placementName(placement)}</span>
									<span className={cn("font-mono text-xs uppercase", placeTone(placement.place))}>{placeName}</span>
								</div>
							</Link>
						);
					})}
				</div>
			)}

			{otherRanked.length > 0 && (
				<div className="flex flex-col gap-3">
					<div className="flex items-center gap-3">
						<GraphRule className="flex-1" />
						<span className="font-mono text-xs text-graph-muted uppercase">other placements</span>
						<GraphRule className="flex-1" />
					</div>
					<ul className="grid gap-2 sm:grid-cols-2">
						{otherRanked.map((placement) => (
							<li key={placement.pluginId} className="flex min-w-0 items-center justify-between gap-4 text-sm">
								<span className="font-mono text-graph-muted">#{placement.place}</span>
								<PlacementLink placement={placement} className="text-right" />
								{prizeLabel(placement.prize) ? (
									<span className="font-mono text-graph-muted tabular-nums">{prizeLabel(placement.prize)}</span>
								) : null}
							</li>
						))}
					</ul>
				</div>
			)}

			{honorable.length > 0 && (
				<div className="flex flex-col gap-3 text-graph-muted">
					<div className="flex items-center gap-3">
						<GraphRule className="flex-1" />
						<span className="font-mono text-xs uppercase">honorable mentions</span>
						<GraphRule className="flex-1" />
					</div>
					<ul className="grid gap-2 text-sm sm:grid-cols-2">
						{honorable.map((placement) => (
							<li key={placement.pluginId} className="flex min-w-0 items-center justify-between gap-4">
								<span className="font-mono text-xs uppercase">recognized</span>
								<PlacementLink placement={placement} className="text-right" />
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

function UpcomingCompetition() {
	return (
		<Graph title="Next competition" tone="positive">
			<GraphBody className="flex flex-col gap-6">
				<div className="flex flex-wrap items-start justify-between gap-5">
					<div className="flex flex-col gap-2">
						<p className="font-mono text-xs text-graph-positive uppercase">announced · details pending</p>
						<h1 className="font-heading text-2xl">The next plugin competition</h1>
					</div>
					<div className="flex flex-col gap-1 sm:items-end">
						<span className="font-mono text-xs text-graph-muted uppercase">prize pool</span>
						<strong className="font-mono text-3xl text-graph-warning tabular-nums">$10,000</strong>
					</div>
				</div>

				<div className="flex gap-3">
					<div aria-hidden="true" className="graph-rule-y shrink-0" />
					<blockquote className="max-w-3xl text-lg leading-relaxed">“{UPCOMING_COMPETITION.message}”</blockquote>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-3 font-mono text-xs uppercase">
					<span className="text-graph-muted">everything is eligible · previous winners excluded</span>
					<a
						href={UPCOMING_COMPETITION.announcementUrl}
						target="_blank"
						rel="noreferrer"
						className="text-graph-accent hover:underline"
					>
						official announcement ↗
					</a>
				</div>
			</GraphBody>
		</Graph>
	);
}

function CompetitionsPage() {
	const { competitions } = useSuspenseQuery(competitionsQuery()).data;
	return (
		<div className="flex flex-col gap-8">
			<UpcomingCompetition />
			<h2 className="font-heading text-2xl">Hall of fame</h2>
			{competitions.map((competition) => (
				<Graph key={competition.id} title={competition.title}>
					<GraphBody className="flex flex-col gap-5">
						<div className="flex justify-between gap-4 text-sm text-muted-foreground">
							<span>{fmtDate(competition.announcedAt)}</span>
							<a
								href={competition.announcementUrl}
								target="_blank"
								rel="noreferrer"
								className="text-graph-accent hover:underline"
							>
								announcement ↗
							</a>
						</div>
						<CompetitionPlacements placements={competition.placements} />
					</GraphBody>
				</Graph>
			))}
		</div>
	);
}
