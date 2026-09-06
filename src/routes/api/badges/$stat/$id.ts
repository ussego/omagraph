import "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { drizzle } from "drizzle-orm/d1";
import { BADGE_COLORS, cap } from "@/lib/api-helpers";
import type { BadgeResponse } from "@/lib/api-types";
import { badgeResponse, parseBadgeTarget } from "@/lib/badge-svg";
import { badgeValue, isStat } from "@/lib/badges";

export const Route = createFileRoute("/api/badges/$stat/$id")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const { stat } = params;
				if (!isStat(stat))
					return Response.json({ error: "stat must be views, copies, or hearts" }, { status: 400 });
				const { id, format } = parseBadgeTarget(params.id);
				const value = await badgeValue(drizzle(env.DB), stat, id);
				if (value === null) return Response.json({ error: "not found" }, { status: 404 });
				const q = new URL(request.url).searchParams;
				return badgeResponse(format, {
					schemaVersion: 1,
					label: q.get("label") ?? cap(stat),
					message: String(value),
					color: q.get("color") ?? BADGE_COLORS[stat],
				} satisfies BadgeResponse);
			},
		},
	},
});
