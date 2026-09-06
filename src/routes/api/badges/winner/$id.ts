import "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { drizzle } from "drizzle-orm/d1";
import { badgeResponse, parseBadgeTarget } from "@/lib/badge-svg";
import { placementsByPlugin } from "@/lib/competitions";

export const Route = createFileRoute("/api/badges/winner/$id")({
	server: { handlers: { GET: async ({ params }) => {
		const { id, format } = parseBadgeTarget(params.id);
		const placement = (await placementsByPlugin(drizzle(env.DB), id))[0];
		if (!placement) return Response.json({ error: "not found" }, { status: 404 });
		const number = placement.competitionId.match(/(\d+)$/)?.[1] ?? placement.competitionId;
		const suffix = placement.place === 0 ? "HONORABLE" : `${placement.place}${placement.place === 1 ? "ST" : placement.place === 2 ? "ND" : placement.place === 3 ? "RD" : "TH"}`;
		return badgeResponse(format, { schemaVersion: 1, label: "Winner", message: `COMP #${Number(number)} · ${suffix}`, color: "#005fc6" });
	} } },
});
