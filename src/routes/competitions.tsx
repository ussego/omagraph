/** @jsxImportSource react */
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Graph, GraphBody } from "@/components/graph-frame/graph-frame";
import { fmtDate } from "@/lib/format";
import { competitionsQuery } from "@/lib/queries";
import { pageHead } from "@/lib/site";

export const Route = createFileRoute("/competitions")({
	loader: ({ context: { queryClient } }) => queryClient.query({ ...competitionsQuery(), staleTime: "static" }),
	head: () => pageHead("Competitions · Omachi", "The Omarchy plugin competition hall of fame.", "/competitions"),
	component: CompetitionsPage,
});

function CompetitionsPage() {
	const { competitions } = useSuspenseQuery(competitionsQuery()).data;
	return <div className="flex flex-col gap-8"><h1 className="font-heading text-2xl">Hall of fame</h1>{competitions.map((competition) => <Graph key={competition.id} title={competition.title}><GraphBody className="flex flex-col gap-5"><div className="flex justify-between gap-4 text-sm text-muted-foreground"><span>{fmtDate(competition.announcedAt)}</span><a href={competition.announcementUrl} target="_blank" rel="noreferrer" className="text-graph-accent hover:underline">announcement ↗</a></div><ol className="flex flex-col gap-3">{competition.placements.map((placement) => <li key={placement.pluginId} className="flex justify-between gap-4"><Link to="/plugins/$pluginId" params={{ pluginId: placement.pluginId }} className="hover:underline">{placement.name ?? placement.pluginId}</Link><span className="font-mono text-muted-foreground">{placement.place === 0 ? "honorable" : `#${placement.place}`}{placement.prize ? ` · $${placement.prize}` : ""}</span></li>)}</ol></GraphBody></Graph>)}</div>;
}
