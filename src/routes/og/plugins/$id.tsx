import "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { ImageResponse } from "takumi-js/response";

import { plugins } from "@/db/schema";
import { placementsByPlugin } from "@/lib/competitions";

const WIDTH = 1200;
const HEIGHT = 630;
const CACHE_CONTROL = "public, s-maxage=3600";
const BACKGROUND = "#0b0f14";
const FOREGROUND = "#f4f4f5";
const ACCENT = "#69a1e8";
const MUTED = "#9f9fa9";
const FRAME = "rgba(244, 244, 245, 0.28)";

function dashedRule(direction: "to right" | "to bottom") {
	return `repeating-linear-gradient(${direction}, ${FRAME} 0 2px, transparent 2px 7px)`;
}

function Corner({ x, y }: { x: number; y: number }) {
	return (
		<div
			aria-hidden="true"
			style={{
				position: "absolute",
				zIndex: 1,
				left: x - 8,
				top: y - 8,
				width: 16,
				height: 16,
				backgroundColor: BACKGROUND,
				color: ACCENT,
				fontFamily: "sans-serif",
				fontSize: 18,
				lineHeight: 1,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			{"+"}
		</div>
	);
}

function clip(value: string, length: number) {
	return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function formatNumber(value: number | null) {
	return value == null ? "—" : new Intl.NumberFormat("en-US").format(value);
}

function PluginOgCard({
	name,
	author,
	views,
	copies,
	hearts,
	winner,
}: {
	name: string;
	author: string | null;
	views: number | null;
	copies: number | null;
	hearts: number | null;
	winner: boolean;
}) {
	const stats = [
		["HEARTS", formatNumber(hearts)],
		["VIEWS", formatNumber(views)],
		["COPIES", formatNumber(copies)],
	];

	return (
		<div
			style={{
				position: "relative",
				width: WIDTH,
				height: HEIGHT,
				padding: 64,
				backgroundColor: BACKGROUND,
				color: FOREGROUND,
				fontFamily: "Geist Variable, sans-serif",
				overflow: "hidden",
			}}
		>
			<div
				style={{
					position: "absolute",
					inset: 64,
					backgroundImage: `${dashedRule("to right")}, ${dashedRule("to bottom")}`,
					backgroundSize: "100% 1px, 1px 100%",
					backgroundPosition: "top, left",
					backgroundRepeat: "repeat-x, repeat-y",
				}}
			/>
			<div
				style={{
					position: "absolute",
					top: 64,
					right: 64,
					width: 1,
					height: HEIGHT - 128,
					backgroundImage: dashedRule("to bottom"),
				}}
			/>
			<div
				style={{
					position: "absolute",
					left: 64,
					bottom: 64,
					width: WIDTH - 128,
					height: 1,
					backgroundImage: dashedRule("to right"),
				}}
			/>
			<Corner x={64} y={64} />
			<Corner x={WIDTH - 64} y={64} />
			<Corner x={64} y={HEIGHT - 64} />
			<Corner x={WIDTH - 64} y={HEIGHT - 64} />
			<div
				style={{
					position: "relative",
					display: "flex",
					flexDirection: "column",
					height: "100%",
					padding: 40,
				}}
			>
				<div style={{ fontFamily: "Geist Mono, monospace", fontSize: 18, color: ACCENT, letterSpacing: 3 }}>
					[ PLUGIN STATS ]
				</div>
				<div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
					<div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.05 }}>{clip(name, 32)}</div>
					<div style={{ marginTop: 18, fontFamily: "Geist Mono, monospace", fontSize: 24, color: MUTED }}>
						by {clip(author ?? "unknown author", 40)}
					</div>
				</div>
				<div style={{ display: "flex", gap: 64, fontFamily: "Geist Mono, monospace" }}>
					{stats.map(([label, value]) => (
						<div key={label} style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 160 }}>
							<div style={{ fontSize: 16, color: MUTED, letterSpacing: 2 }}>{label}</div>
							<div style={{ fontSize: 36, color: ACCENT }}>{value}</div>
						</div>
					))}
				</div>
			</div>
			{winner && (
				<div
					style={{
						position: "absolute",
						top: 42,
						right: 72,
						padding: "12px 32px",
						backgroundColor: ACCENT,
						color: BACKGROUND,
						fontFamily: "Geist Mono, monospace",
						fontSize: 18,
						fontWeight: 700,
						letterSpacing: 2,
						transform: "rotate(4deg)",
					}}
				>
					WINNER
				</div>
			)}
		</div>
	);
}

async function staticOg(request: Request) {
	const url = new URL("/og.png", request.url);
	let response = await env.SELF.fetch(new Request(url, request));
	// Vite's local Cloudflare runtime does not serve public assets through SELF.
	if (response.status === 404) response = await fetch(url);
	const headers = new Headers(response.headers);
	headers.set("Cache-Control", CACHE_CONTROL);
	return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export const Route = createFileRoute("/og/plugins/$id")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const pluginId = params.id.replace(/\.png$/i, "");
				const db = drizzle(env.DB);
				const [[plugin], placements] = await Promise.all([
					db
						.select({
							name: plugins.name,
							author: plugins.author,
							currentViews: plugins.currentViews,
							currentCopies: plugins.currentCopies,
							currentHearts: plugins.currentHearts,
						})
						.from(plugins)
						.where(eq(plugins.id, pluginId))
						.limit(1)
						.all(),
					placementsByPlugin(db, pluginId),
				]);

				if (!plugin) return staticOg(request);

				const image = new ImageResponse(
					<PluginOgCard
						name={plugin.name ?? pluginId}
						author={plugin.author}
						views={plugin.currentViews}
						copies={plugin.currentCopies}
						hearts={plugin.currentHearts}
						winner={placements.length > 0}
					/>,
					{ width: WIDTH, height: HEIGHT, headers: { "Cache-Control": CACHE_CONTROL } },
				);
				try {
					await image.ready;
					return image;
				} catch {
					return staticOg(request);
				}
			},
		},
	},
});
