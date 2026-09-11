import { schedules } from "@trigger.dev/sdk";

const ADMIN_BASE = "https://stats.ussego.com/api/admin";

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;

/**
 * POST an admin poll endpoint. The Worker owns the D1 work behind the
 * endpoint; Trigger.dev owns the schedule. Returns the endpoint's JSON body.
 */
export async function triggerPoll(fetcher: Fetcher, adminToken: string, endpoint: string): Promise<unknown> {
	const url = `${ADMIN_BASE}${endpoint}`;
	const response = await fetcher(url, { method: "POST", headers: { "x-admin-token": adminToken } });
	if (!response.ok) throw new Error(`${url} failed with ${response.status}`);
	return response.json();
}

function adminToken(): string {
	const token = process.env.ADMIN_TOKEN;
	if (!token) throw new Error("ADMIN_TOKEN is not configured");
	return token;
}

export const heavyPoll = schedules.task({
	id: "heavy-poll",
	cron: { pattern: "7 */8 * * *", timezone: "UTC", environments: ["PRODUCTION"] },
	machine: "micro",
	maxDuration: 600,
	retry: { maxAttempts: 1 },
	ttl: "8h",
	queue: { concurrencyLimit: 1 },
	run: async () => triggerPoll(fetch, adminToken(), "/snapshot"),
});

export const lightPoll = schedules.task({
	id: "light-poll",
	cron: { pattern: "7,37 * * * *", timezone: "UTC", environments: ["PRODUCTION"] },
	machine: "micro",
	maxDuration: 300,
	retry: { maxAttempts: 1 },
	ttl: "30m",
	queue: { concurrencyLimit: 1 },
	run: async () => triggerPoll(fetch, adminToken(), "/light-poll"),
});

export const explorerPoll = schedules.task({
	id: "explorer-poll",
	cron: { pattern: "23 5 * * *", timezone: "UTC", environments: ["PRODUCTION"] },
	machine: "micro",
	maxDuration: 300,
	retry: { maxAttempts: 1 },
	ttl: "24h",
	queue: { concurrencyLimit: 1 },
	run: async () => triggerPoll(fetch, adminToken(), "/explorer-poll"),
});
