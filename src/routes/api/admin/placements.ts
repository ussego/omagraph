import "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { drizzle } from "drizzle-orm/d1";

import { createPlacement, newPlacementSchema } from "@/lib/competitions";
import { adminAuth } from "@/start";

export const Route = createFileRoute("/api/admin/placements")({
	server: {
		middleware: [adminAuth],
		handlers: {
			POST: async ({ request }) => {
				const input = newPlacementSchema.safeParse(await request.json().catch(() => null));
				if (!input.success) return Response.json({ error: "invalid request" }, { status: 400 });

				return Response.json(
					{ placement: await createPlacement(drizzle(env.DB), input.data) },
					{ status: 201 },
				);
			},
		},
	},
});
