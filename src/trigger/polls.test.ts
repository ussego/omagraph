import { describe, expect, it } from "bun:test";

import { triggerPoll } from "@/trigger/polls";

function response(body: unknown, status = 200) {
	return Response.json(body, { status });
}

describe("triggerPoll", () => {
	it("POSTs the admin endpoint with the admin token and returns its JSON body", async () => {
		const requests: Array<{ url: string; init?: RequestInit }> = [];
		const fetcher = async (input: string | URL, init?: RequestInit) => {
			requests.push({ url: input.toString(), init });
			return response({ snapshots: 3, verificationEvents: 0, updateEvents: 1 });
		};

		const result = await triggerPoll(fetcher, "admin", "/snapshot");

		expect(result).toEqual({ snapshots: 3, verificationEvents: 0, updateEvents: 1 });
		expect(requests).toHaveLength(1);
		expect(requests[0]?.url).toBe("https://stats.ussego.com/api/admin/snapshot");
		expect(requests[0]?.init).toMatchObject({ method: "POST", headers: { "x-admin-token": "admin" } });
	});

	it("throws on a non-OK admin response without parsing a body", async () => {
		const fetcher = async () => response({ error: "boom" }, 500);

		return expect(triggerPoll(fetcher, "admin", "/light-poll")).rejects.toThrow(
			"https://stats.ussego.com/api/admin/light-poll failed with 500",
		);
	});
});
