import "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { drizzle } from "drizzle-orm/d1";
import { competitionList } from "@/lib/competitions";
import type { CompetitionsResponse } from "@/lib/api-types";

export const Route = createFileRoute("/api/competitions")({
	server: { handlers: { GET: async () => Response.json({ competitions: await competitionList(drizzle(env.DB)) } satisfies CompetitionsResponse) } },
});
