import "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { drizzle } from "drizzle-orm/d1";

import { ingestSubmissions, readSubmissionCursor, submissionIngestSchema } from "@/lib/submissions";
import { adminAuth } from "@/start";

export const Route = createFileRoute("/api/admin/submissions")({
	server: {
		middleware: [adminAuth],
		handlers: {
			GET: async () => Response.json({ cursor: await readSubmissionCursor(drizzle(env.DB)) }),
			POST: async ({ request }) => {
				const input = submissionIngestSchema.safeParse(await request.json().catch(() => null));
				if (!input.success) return Response.json({ error: "invalid request" }, { status: 400 });

				const cache = (globalThis.caches as unknown as { default: Cache }).default;
				return Response.json(
					await ingestSubmissions(drizzle(env.DB), input.data, () =>
						cache.delete(new URL("/api/stats/submissions", request.url)),
					),
				);
			},
		},
	},
});
