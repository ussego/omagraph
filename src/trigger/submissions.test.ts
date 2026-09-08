import { describe, expect, it } from "bun:test";

import { syncSubmissions } from "@/trigger/submissions";

const ADMIN_URL = "https://stats.ussego.com/api/admin/submissions";
const environment = { ADMIN_TOKEN: "admin", MARKETPLACE_GITHUB_TOKEN: "github" };
const nextCursor = new Date("2026-09-08T12:05:00.000Z");

function response(body: unknown, url: string) {
	const result = Response.json(body);
	Object.defineProperty(result, "url", { value: url });
	return result;
}

describe("submissionSync", () => {
	it("queries only updates since the stored cursor and preserves ingestion wire shapes", async () => {
		const requests: Array<{ url: string; body?: unknown }> = [];
		const fetcher = async (input: string | URL, init?: RequestInit) => {
			const url = input.toString();
			const body = init?.body ? JSON.parse(String(init.body)) : undefined;
			requests.push({ url, body });
			if (url === ADMIN_URL && !init?.method) return response({ cursor: "2026-09-08T12:00:00.000Z" }, url);
			if (url.startsWith("https://api.github.com/"))
				return response(
					[
						{
							number: 42,
							title: "[Plugin]: Example",
							created_at: "2026-09-08T11:00:00Z",
							labels: [{ name: "submission" }],
						},
						{
							number: 43,
							title: "[Verify]: Pull request",
							created_at: "2026-09-08T11:30:00Z",
							labels: [],
							pull_request: {},
						},
					],
					url,
				);
			return response({ inserted: body?.events?.length ?? 0, cursor: body?.cursor ?? null }, url);
		};

		expect(await syncSubmissions(fetcher, environment, nextCursor)).toEqual({
			inserted: 1,
			processed: 1,
			cursor: nextCursor.toISOString(),
		});
		expect(requests[1]?.url).toContain(`since=${encodeURIComponent("2026-09-08T11:59:59.000Z")}`);
		expect(requests.slice(2).map(({ body }) => body)).toEqual([
			{
				events: [
					{
						issueNumber: 42,
						kind: "plugin",
						occurredAt: "2026-09-08T11:00:00Z",
						labels: ["submission"],
					},
				],
			},
			{ events: [], cursor: nextCursor.toISOString() },
		]);
	});

	it("initializes a missing cursor without fetching GitHub history", async () => {
		const urls: string[] = [];
		const fetcher = async (input: string | URL, init?: RequestInit) => {
			const url = input.toString();
			urls.push(url);
			if (!init?.method) return response({ cursor: null }, url);
			return response({ inserted: 0, cursor: nextCursor.toISOString() }, url);
		};

		await syncSubmissions(fetcher, environment, nextCursor);
		expect(urls).toEqual([ADMIN_URL, ADMIN_URL]);
	});
});
