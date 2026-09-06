import "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { drizzle } from "drizzle-orm/d1";
import { BADGE_COLORS, cap } from "@/lib/api-helpers";
import type { BadgeResponse } from "@/lib/api-types";
import { badgeResponse, parseBadgeTarget } from "@/lib/badge-svg";
import { badgeRank, isRankStat } from "@/lib/badges";

export const Route = createFileRoute("/api/badges/ranking/$stat/$id")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const { stat } = params;
				if (!isRankStat(stat))
					return Response.json({ error: "stat must be views, copies, hearts, or avg" }, { status: 400 });
				const { id, format } = parseBadgeTarget(params.id);
				const rank = await badgeRank(drizzle(env.DB), stat, id);
				if (!rank) return Response.json({ error: "not found" }, { status: 404 });
				const q = new URL(request.url).searchParams;
				return badgeResponse(format, {
					schemaVersion: 1,
					label: `${stat === "avg" ? "Avg" : cap(stat)} rank`,
					message: String(rank.rank),
					color: q.get("color") ?? BADGE_COLORS[stat],
				} satisfies BadgeResponse);
			},
		},
	},
});
