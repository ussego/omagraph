import "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { drizzle } from "drizzle-orm/d1";

import { submissionStatsResponse } from "@/lib/submissions";

export const Route = createFileRoute("/api/stats/submissions")({
	server: {
		handlers: {
			GET: () => submissionStatsResponse(drizzle(env.DB)),
		},
	},
});
