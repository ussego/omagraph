import { describe, expect, it } from "bun:test";

import { badgeColor, badgeResponse, badgeSvg, parseBadgeTarget } from "@/lib/badge-svg";

describe("badge SVG", () => {
	it("renders extensionless and .svg targets as escaped blueprint SVG", async () => {
		expect(parseBadgeTarget("ussego.otoru")).toEqual({ id: "ussego.otoru", format: "svg" });
		expect(parseBadgeTarget("ussego.otoru.svg")).toEqual({ id: "ussego.otoru", format: "svg" });

		const response = badgeResponse("svg", {
			schemaVersion: 1,
			label: "Views & more",
			message: "<109>",
			color: "blue",
		});
		const svg = await response.text();

		expect(response.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
		expect(svg).toContain("<title>VIEWS &amp; MORE: &lt;109&gt;</title>");
		expect(svg).toContain(
			'font-family="Geist Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"',
		);
		expect(svg).toContain('fill="#005fc6"');
		expect(svg).toContain('stroke-dasharray="2 5"');
		expect(svg).not.toContain("Views & more");
	});
	it("resolves per-stat defaults and ?color= overrides", () => {
		expect(badgeColor("red")).toBe("#e05d44");
		expect(badgeColor("blue")).toBe("#005fc6");
		expect(badgeColor("green")).toBe("#44cc11");
		expect(badgeColor("#123abc")).toBe("#123abc");
		expect(badgeColor("nope")).toBe("#005fc6");
		expect(badgeSvg("Hearts", "10", "red")).toContain('fill="#e05d44"');
		expect(badgeSvg("Copies", "10", "green")).toContain('fill="#44cc11"');
	});

	it("keeps .json targets on the legacy shields schema", async () => {
		expect(parseBadgeTarget("ussego.otoru.JSON")).toEqual({ id: "ussego.otoru", format: "json" });

		const response = badgeResponse("json", {
			schemaVersion: 1,
			label: "Views",
			message: "109",
			color: "blue",
		});

		expect(response.headers.get("content-type")).toContain("application/json");
		expect(await response.text()).toBe('{"schemaVersion":1,"label":"Views","message":"109","color":"blue"}');
	});
});
