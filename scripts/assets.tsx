/** @jsxImportSource react */
/**
 * Build-time brand assets, rendered with takumi (no headless browser, no
 * runtime cost — the Worker never sees this code). Run via `bun run assets`;
 * `bun run build` runs it first. Writes public/og.png, public/favicon.ico and
 * public/favicon.png.
 *
 * The OG card mirrors the blueprint shell from docs/design.md: one soft
 * dashed page frame with `+` junctions, a centered `[O]` mark / wordmark /
 * tagline lockup, and a frameless ascii area chart as the data ground — the
 * site's chart voice, demoted to a horizon line. The favicon is the same
 * typographic `[O]` artwork, downsampled to tab size, so both icons are one
 * drawing at different scales.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CSSProperties } from "react";
import { PNG } from "pngjs";
import { render } from "takumi-js";

const FONT_DIR = (pkg: string, file: string) => join(import.meta.dirname, "..", "node_modules", pkg, "files", file);

const FONTS = [
	{
		name: "Geist Mono",
		data: await readFile(FONT_DIR("@fontsource-variable/geist-mono", "geist-mono-latin-wght-normal.woff2")),
	},
	{
		name: "Geist Variable",
		data: await readFile(FONT_DIR("@fontsource-variable/geist", "geist-latin-wght-normal.woff2")),
	},
];

// Dark-mode tokens (oklch -> sRGB, see src/styles.css): the OG canvas is dark,
// so the art uses the dark theme's accent family and frame inks.
const SITE_BACKGROUND = "#0b0f14";
const SITE_FOREGROUND = "#f4f4f5";
const ACCENT = "#69a1e8"; // --graph-accent
const ACCENT_3 = "#496b96"; // --graph-accent-3, the chart-fill tone
const MUTED = "#9f9fa9"; // --muted-foreground
const SHELL_INK = "rgba(244, 244, 245, 0.28)"; // page frame, dialed to card visibility
const SHELL_CORNER = "rgba(244, 244, 245, 0.55)"; // `+` junctions

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const SHELL_X = 64; // page-frame inset from the canvas edges
const RULE_TOP = 64; // top soft rule y
const RULE_BOTTOM = 566; // bottom soft rule y
// Glyph-quantized: 104 chart columns at the 9px mono advance (15px font), so
// the ascii chart spans the content column edge-to-edge and the title block's
// right edge lands on the chart's last column.
const CONTENT_WIDTH = 936;

/** The 2px-dash / 5px-gap rule used by every graph-frame utility in styles.css. */
function dashedRule(horizontal: boolean, color: string) {
	const gradient = horizontal
		? `repeating-linear-gradient(to right, ${color} 0 2px, transparent 2px 7px)`
		: `repeating-linear-gradient(to bottom, ${color} 0 2px, transparent 2px 7px)`;
	return `${gradient}`;
}

function mono(size: number, color: string, extra: CSSProperties = {}): CSSProperties {
	return {
		fontFamily: "Geist Mono",
		fontSize: size,
		color,
		whiteSpace: "pre",
		...extra,
	};
}

function sans(size: number, weight: number, color: string, extra: CSSProperties = {}): CSSProperties {
	return {
		fontFamily: "Geist Variable",
		fontSize: size,
		fontWeight: weight,
		color,
		...extra,
	};
}

function Rule({ x, y, width, height, color }: { x: number; y: number; width: number; height: number; color: string }) {
	const horizontal = height === 1;
	return (
		<div
			aria-hidden="true"
			style={{
				position: "absolute",
				left: x,
				top: y,
				width,
				height,
				backgroundImage: dashedRule(horizontal, color),
				backgroundRepeat: horizontal ? "repeat-x" : "repeat-y",
				backgroundSize: horizontal ? "100% 1px" : "1px 100%",
			}}
		/>
	);
}

/** A `+` corner mark on a solid punch-out, straddling its junction. */
function Plus({ x, y, size, color }: { x: number; y: number; size: number; color: string }) {
	return (
		<div
			aria-hidden="true"
			style={{
				position: "absolute",
				left: x - size / 2,
				top: y - size / 2,
				width: size,
				height: size,
				backgroundColor: SITE_BACKGROUND,
				color,
				fontFamily: "Geist Mono",
				fontSize: Math.round(size * 0.7),
				lineHeight: 1,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			+
		</div>
	);
}

// ------------------------------------------------------------------ og.png

const CHART_ROWS = 5;
const CHART_FONT = 15; // px per glyph row; mono advance 0.6em => 9px columns

/**
 * Decorative cumulative history for the chart glyphs — a climb with ripple
 * into the present. The card never draws a number, so it cannot go stale.
 */
const TREND: number[] = Array.from({ length: 104 }, (_, i) => {
	const t = i / 103;
	const growth = Math.min(1, t * t * 1.25);
	const ripple = 0.1 * Math.sin(i * 0.42 + 1) + 0.07 * Math.sin(i * 1.7) + 0.05 * Math.sin(i * 0.11);
	return Math.min(1, Math.max(0.04, growth * 0.92 + ripple * 0.08));
});

/** One glyph row of the ascii area chart: `@` caps on `-` fill (site's ascii voice). */
function chartRow(rowFromBottom: number): string {
	let line = "";
	for (const v of TREND) {
		const level = Math.min(CHART_ROWS, 1 + Math.floor(v * CHART_ROWS));
		if (rowFromBottom === level - 1) line += "@";
		else if (rowFromBottom < level - 1) line += "-";
		else line += " ";
	}
	return line;
}

function OgCard() {
	const shellRight = OG_WIDTH - SHELL_X;
	const innerLeft = (OG_WIDTH - CONTENT_WIDTH) / 2;
	const contentTop = RULE_TOP + 30;
	const contentBottom = RULE_BOTTOM - 24;

	return (
		<div
			style={{
				width: OG_WIDTH,
				height: OG_HEIGHT,
				backgroundColor: SITE_BACKGROUND,
				position: "relative",
				overflow: "hidden",
			}}
		>
			{/* page frame: soft dashed rules with `+` junctions, like the site shell */}
			<Rule x={SHELL_X} y={RULE_TOP} width={shellRight - SHELL_X} height={1} color={SHELL_INK} />
			<Rule x={SHELL_X} y={RULE_BOTTOM} width={shellRight - SHELL_X} height={1} color={SHELL_INK} />
			<Rule x={SHELL_X} y={RULE_TOP} width={1} height={RULE_BOTTOM - RULE_TOP} color={SHELL_INK} />
			<Rule x={shellRight} y={RULE_TOP} width={1} height={RULE_BOTTOM - RULE_TOP} color={SHELL_INK} />
			<Plus x={SHELL_X} y={RULE_TOP} size={26} color={SHELL_CORNER} />
			<Plus x={shellRight} y={RULE_TOP} size={26} color={SHELL_CORNER} />
			<Plus x={SHELL_X} y={RULE_BOTTOM} size={26} color={SHELL_CORNER} />
			<Plus x={shellRight} y={RULE_BOTTOM} size={26} color={SHELL_CORNER} />

			{/* one centered lockup over one data ground — no second frame */}
			<div
				style={{
					position: "absolute",
					left: innerLeft,
					top: contentTop,
					width: CONTENT_WIDTH,
					height: contentBottom - contentTop,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
				}}
			>
				<div style={mono(170, ACCENT, { fontWeight: 700, lineHeight: 1 })}>[O]</div>
				{/* trailing letter-space pulled back so the tracked run centers truly */}
				<div style={mono(26, SITE_FOREGROUND, { letterSpacing: 14, marginRight: -14, lineHeight: 1, marginTop: 34 })}>
					OMAGRAPH
				</div>
				<div style={sans(30, 500, MUTED, { lineHeight: 1, marginTop: 22 })}>
					Independent analytics for the Omarchy plugin catalog
				</div>

				<div style={{ flex: 1 }} />

				{/* data ground: the ascii area chart, frameless, at content width */}
				<div style={{ width: CONTENT_WIDTH, height: CHART_ROWS * CHART_FONT, lineHeight: 1 }}>
					{Array.from({ length: CHART_ROWS }, (_, row) => {
						const line = chartRow(CHART_ROWS - 1 - row);
						return (
							// biome-ignore lint/suspicious/noArrayIndexKey: static glyph grid, rows never reorder
							<div key={row} style={mono(CHART_FONT, ACCENT, { height: CHART_FONT, lineHeight: 1 })}>
								{line.split("").map((ch, i) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: static glyph grid, cells never reorder
									<span key={i} style={{ color: ch === "-" ? ACCENT_3 : ACCENT }}>
										{ch}
									</span>
								))}
							</div>
						);
					})}
				</div>

				{/* title block: the one address, right-aligned like a drawing stamp */}
				<div style={{ width: CONTENT_WIDTH, display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
					<span style={mono(13, MUTED, { letterSpacing: 2 })}>STATS.USSEGO.COM</span>
				</div>
			</div>
		</div>
	);
}

// ------------------------------------------------------------------ favicon

// The favicon is the same artwork as the OG mark — the typographic [O] in
// Geist Mono 700, rendered by takumi and box-downsampled to tab size — and it
// wears the same accent (#69a1e8). The tab icon and the card icon are then
// one drawing at different scales, in one color, not a redrawn approximation.

const MARK_TEXT = "[O]";
const MARK_FONT = 512; // render large so downsampled edges stay clean

/** Rasterize the mark text and return its ink alpha, cropped to the glyph bounds. */
async function markGlyphAlpha(): Promise<{ alpha: Uint8Array; width: number; height: number }> {
	const cell = Math.ceil(MARK_FONT * 2);
	const rendered = await render(
		<div
			style={{
				width: cell,
				height: cell,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<div
				style={{
					fontFamily: "Geist Mono",
					fontSize: MARK_FONT,
					fontWeight: 700,
					lineHeight: 1,
					color: "white",
					whiteSpace: "pre",
				}}
			>
				{MARK_TEXT}
			</div>
		</div>,
		{ width: cell, height: cell, fonts: FONTS },
	);
	const png = PNG.sync.read(Buffer.from(rendered));
	const { width, height, data } = png;

	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (data[(y * width + x) * 4 + 3] > 8) {
				if (x < minX) minX = x;
				if (x > maxX) maxX = x;
				if (y < minY) minY = y;
				if (y > maxY) maxY = y;
			}
		}
	}
	if (maxX < minX || maxY < minY) throw new Error("favicon mark text did not render");

	const bw = maxX - minX + 1;
	const bh = maxY - minY + 1;
	const alpha = new Uint8Array(bw * bh);
	for (let y = 0; y < bh; y++) {
		for (let x = 0; x < bw; x++) {
			alpha[y * bw + x] = data[((y + minY) * width + (x + minX)) * 4 + 3];
		}
	}
	return { alpha, width: bw, height: bh };
}

/** Area-average the cropped glyph into a size×size mask with `pad` empty px around it. */
function downsampleMark(alpha: Uint8Array, srcWidth: number, srcHeight: number, size: number, pad: number): Uint8Array {
	const out = new Uint8Array(size * size);
	// Fit the artwork inside the padded box at a uniform scale — the aspect is
	// the font's own, so it must never be stretched to fill the square.
	const inner = size - pad * 2;
	const scale = Math.min(inner / srcWidth, inner / srcHeight);
	const offX = pad + (inner - srcWidth * scale) / 2;
	const offY = pad + (inner - srcHeight * scale) / 2;
	for (let py = 0; py < size; py++) {
		const yA = (py - offY) / scale;
		const yB = yA + 1 / scale;
		for (let px = 0; px < size; px++) {
			const xA = (px - offX) / scale;
			const xB = xA + 1 / scale;
			let sum = 0;
			for (let iy = Math.floor(yA); iy < Math.ceil(yB); iy++) {
				const oy = Math.min(iy + 1, yB) - Math.max(iy, yA);
				if (oy <= 0) continue;
				for (let ix = Math.floor(xA); ix < Math.ceil(xB); ix++) {
					const ox = Math.min(ix + 1, xB) - Math.max(ix, xA);
					if (ox <= 0) continue;
					// Skip samples outside the glyph: a negative index would wrap
					// into the previous scanline and smear mirrored ink into the
					// margin (which is why the pads looked full-bleed before).
					if (iy < 0 || iy >= srcHeight || ix < 0 || ix >= srcWidth) continue;
					sum += alpha[iy * srcWidth + ix] * ox * oy;
				}
			}
			out[py * size + px] = Math.round(sum * scale * scale);
		}
	}
	return out;
}

/** The one graph accent as a solid fill, preserving antialiasing. */
function accentGlyph(mask: Uint8Array, size: number, color: { red: number; green: number; blue: number }): Uint8Array {
	const png = new PNG({ width: size, height: size });
	for (let i = 0; i < size * size; i++) {
		png.data[i * 4] = color.red;
		png.data[i * 4 + 1] = color.green;
		png.data[i * 4 + 2] = color.blue;
		png.data[i * 4 + 3] = mask[i];
	}
	return PNG.sync.write(png);
}

/** Parse "#rrggbb" into the channel object accentGlyph needs. */
function hexRgb(hex: string): { red: number; green: number; blue: number } {
	return {
		red: Number.parseInt(hex.slice(1, 3), 16),
		green: Number.parseInt(hex.slice(3, 5), 16),
		blue: Number.parseInt(hex.slice(5, 7), 16),
	};
}

// The one graph accent as drawn in the OG card — the favicon is that same
// artwork, so it shares that same ink (no theme variants: one accent).
const FAVICON_RGB = hexRgb(ACCENT);

function renderFavicon(mark: { alpha: Uint8Array; width: number; height: number }, size: number): Uint8Array {
	const pad = Math.max(1, Math.round(size * 0.05));
	const mask = downsampleMark(mark.alpha, mark.width, mark.height, size, pad);
	return accentGlyph(mask, size, FAVICON_RGB);
}

/** Pack PNG-compressed frames into a classic ICO container (16/32/48). */
function packIco(frames: { size: number; png: Uint8Array }[]): Uint8Array {
	const header = 6 + 16 * frames.length;
	const out = new Uint8Array(header + frames.reduce((total, frame) => total + frame.png.length, 0));
	out[2] = 1; // type: ICO
	out[4] = frames.length;
	let offset = header;
	frames.forEach((frame, index) => {
		const entry = 6 + index * 16;
		out[entry] = frame.size;
		out[entry + 1] = frame.size;
		out[entry + 4] = 1; // planes
		out[entry + 6] = 32; // bitcount (LE bytes 6-7)
		out[entry + 8] = frame.png.length & 0xff;
		out[entry + 9] = (frame.png.length >>> 8) & 0xff;
		out[entry + 10] = (frame.png.length >>> 16) & 0xff;
		out[entry + 11] = (frame.png.length >>> 24) & 0xff;
		out[entry + 12] = offset & 0xff;
		out[entry + 13] = (offset >>> 8) & 0xff;
		out[entry + 14] = (offset >>> 16) & 0xff;
		out[entry + 15] = (offset >>> 24) & 0xff;
		out.set(frame.png, offset);
		offset += frame.png.length;
	});
	return out;
}

// ------------------------------------------------------------------ main

const publicDir = join(import.meta.dirname, "..", "public");

const ogPng = await render(<OgCard />, { width: OG_WIDTH, height: OG_HEIGHT, fonts: FONTS });
const pngSignature = ogPng[0] === 0x89 && ogPng[1] === 0x50 && ogPng[2] === 0x4e && ogPng[3] === 0x47;
if (!pngSignature || ogPng.length < 1000) throw new Error(`og.png looks wrong: ${ogPng.length} bytes`);
await writeFile(join(publicDir, "og.png"), ogPng);
console.log(`og.png: ${(ogPng.length / 1024).toFixed(1)} KiB`);

const faviconMark = await markGlyphAlpha();
console.log(
	`favicon mark: ${faviconMark.width}x${faviconMark.height}px of glyph ink (from ${MARK_TEXT} at ${MARK_FONT}px)`,
);

const ico = packIco([16, 32, 48].map((size) => ({ size, png: renderFavicon(faviconMark, size) })));
await writeFile(join(publicDir, "favicon.ico"), ico);
console.log(`favicon.ico: ${ico.length} bytes`);

const faviconPng = renderFavicon(faviconMark, 64);
await writeFile(join(publicDir, "favicon.png"), faviconPng);
console.log(`favicon.png: ${faviconPng.length} bytes`);
