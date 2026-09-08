import { schedules } from "@trigger.dev/sdk";
import { z } from "zod";

const ADMIN_URL = "https://stats.ussego.com/api/admin/submissions";
const GITHUB_URL = "https://api.github.com/repos/omacom/omarchy-plugin-marketplace/issues";
const PAGE_SIZE = 100;

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;
type SyncEnvironment = {
	ADMIN_TOKEN: string;
	MARKETPLACE_GITHUB_TOKEN: string;
};

const cursorResponseSchema = z.object({ cursor: z.iso.datetime({ offset: true }).nullable() });
const ingestResponseSchema = z.object({ inserted: z.number().int().nonnegative(), cursor: z.string().nullable() });
const githubIssuesSchema = z.array(
	z.object({
		number: z.number().int().positive(),
		title: z.string(),
		created_at: z.iso.datetime({ offset: true }),
		labels: z.array(z.object({ name: z.string() })),
		pull_request: z.unknown().optional(),
	}),
);

async function json(response: Response) {
	if (!response.ok) throw new Error(`${response.url || "Request"} failed with ${response.status}`);
	return response.json();
}

export async function syncSubmissions(fetcher: Fetcher, environment: SyncEnvironment, nextCursor: Date) {
	const adminHeaders = { "x-admin-token": environment.ADMIN_TOKEN };
	const { cursor } = cursorResponseSchema.parse(await json(await fetcher(ADMIN_URL, { headers: adminHeaders })));

	const post = async (body: object) =>
		ingestResponseSchema.parse(
			await json(
				await fetcher(ADMIN_URL, {
					method: "POST",
					headers: { ...adminHeaders, "content-type": "application/json" },
					body: JSON.stringify(body),
				}),
			),
		);

	if (!cursor) {
		const result = await post({ events: [], cursor: nextCursor.toISOString() });
		return { inserted: result.inserted, processed: 0, cursor: result.cursor };
	}

	const since = new Date(Date.parse(cursor) - 1_000).toISOString();
	let inserted = 0;
	let processed = 0;
	for (let page = 1; ; page++) {
		const url = new URL(GITHUB_URL);
		url.search = new URLSearchParams({
			state: "all",
			sort: "updated",
			direction: "asc",
			per_page: String(PAGE_SIZE),
			since,
			page: String(page),
		}).toString();
		const issues = githubIssuesSchema.parse(
			await json(
				await fetcher(url, {
					headers: {
						accept: "application/vnd.github+json",
						authorization: `Bearer ${environment.MARKETPLACE_GITHUB_TOKEN}`,
						"x-github-api-version": "2022-11-28",
					},
				}),
			),
		);
		const events = issues.flatMap((issue) => {
			if (issue.pull_request !== undefined) return [];
			const kind = issue.title.startsWith("[Plugin]:")
				? "plugin"
				: issue.title.startsWith("[Verify]:")
					? "verification"
					: null;
			return kind
				? [
						{
							issueNumber: issue.number,
							kind,
							occurredAt: issue.created_at,
							labels: issue.labels.map(({ name }) => name),
						},
					]
				: [];
		});
		processed += events.length;
		if (events.length > 0) inserted += (await post({ events })).inserted;
		if (issues.length < PAGE_SIZE) break;
	}

	const result = await post({ events: [], cursor: nextCursor.toISOString() });
	return { inserted, processed, cursor: result.cursor };
}

export const submissionSync = schedules.task({
	id: "submission-sync",
	cron: { pattern: "*/5 * * * *", timezone: "UTC", environments: ["PRODUCTION"] },
	machine: "micro",
	maxDuration: 30,
	retry: { maxAttempts: 1 },
	ttl: "5m",
	queue: { concurrencyLimit: 1 },
	run: async ({ timestamp }) => {
		const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
		const MARKETPLACE_GITHUB_TOKEN = process.env.MARKETPLACE_GITHUB_TOKEN;
		if (!ADMIN_TOKEN || !MARKETPLACE_GITHUB_TOKEN) throw new Error("Submission sync secrets are not configured");
		return syncSubmissions(fetch, { ADMIN_TOKEN, MARKETPLACE_GITHUB_TOKEN }, timestamp);
	},
});
