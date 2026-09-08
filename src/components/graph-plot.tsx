"use client";

import { motion, useReducedMotion } from "motion/react";
import * as React from "react";

import { Graph, GraphBody, GraphRule, type GraphTone } from "@/components/graph-frame/graph-frame";
import {
	clamp01,
	fillDelay,
	GRAPH_TIP_CLASS,
	type Glyphs,
	type GraphPalette,
	graphTransition,
	toneClass,
	trackMarks,
} from "@/components/graph-frame/graph-motion";
import { cn } from "@/lib/utils";

type GraphPlotProps = {
	title: string;
	data: number[];
	labels?: string[];
	tooltipLabels?: string[];
	height?: number;
	variant?: "line" | "area";
	progress?: number;
	glyphs?: Glyphs;
	palette?: GraphPalette;
	tone?: GraphTone;
	corner?: string;
	className?: string;
};

function formatTick(value: number) {
	if (Number.isInteger(value)) {
		return String(value);
	}

	return value.toFixed(1);
}

type GraphPlotBodyProps = Omit<GraphPlotProps, "title" | "corner" | "className">;

function GraphPlotBody({
	data,
	labels,
	tooltipLabels,
	height = 7,
	variant = "area",
	progress = 1,
	glyphs,
	palette,
	tone,
}: GraphPlotBodyProps) {
	const reduce = useReducedMotion();
	const [active, setActive] = React.useState<number | null>(null);
	const max = Math.max(...data, 0);
	const min = Math.min(0, ...data);
	const range = max - min || 1;
	const end = labels?.[labels.length - 1];
	const start = labels?.[0];
	const yLabel = formatTick(max);
	const revealed = Math.round(clamp01(progress) * data.length);
	const lastLive = Math.max(0, revealed - 1);
	const marks = trackMarks(glyphs);
	const last = data.length - 1;
	const activeIndex = active != null && active >= 0 && active <= last ? active : null;
	const activePct = activeIndex != null ? ((activeIndex + 0.5) / data.length) * 100 : 0;
	const activeAlign = activePct < 18 ? "left" : activePct > 82 ? "right" : "center";
	const activeLabel = activeIndex != null ? (tooltipLabels?.[activeIndex] ?? labels?.[activeIndex]) : undefined;
	const activeValue = activeIndex != null ? (data[activeIndex] ?? 0) : 0;
	const tooltip =
		activeIndex != null ? (
			<span
				aria-hidden="true"
				className={cn(GRAPH_TIP_CLASS, "top-1/2")}
				style={{
					left: `${activePct}%`,
					transform: `${activeAlign === "center" ? "translateX(-50%)" : activeAlign === "left" ? "translateX(0)" : "translateX(-100%)"} translateY(calc(-50% + 3px))`,
				}}
			>
				{activeLabel ? <span className="text-graph-muted">{activeLabel} </span> : null}
				<span className={palette ? toneClass(palette, "primary", tone) : "text-foreground"}>
					{formatTick(activeValue)}
				</span>
			</span>
		) : null;
	const cursorLine =
		activeIndex != null ? (
			<span
				aria-hidden="true"
				className="pointer-events-none absolute graph-rule-y"
				style={{ left: `${activePct}%`, top: "-0.375rem", bottom: "50%" }}
			/>
		) : null;

	function stepActive(delta: number) {
		setActive((prev) => {
			if (last < 0) {
				return null;
			}
			const base = prev ?? lastLive;
			return Math.min(last, Math.max(0, base + delta));
		});
	}

	function onPlotKeyDown(event: React.KeyboardEvent) {
		if (event.key === "ArrowRight" || event.key === "ArrowDown") {
			event.preventDefault();
			stepActive(1);
		} else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
			event.preventDefault();
			stepActive(-1);
		} else if (event.key === "Home") {
			event.preventDefault();
			setActive(0);
		} else if (event.key === "End") {
			event.preventDefault();
			setActive(last);
		} else if (event.key === "Escape") {
			setActive(null);
		}
	}

	return (
		<>
				<div className="flex gap-3">
					<div
						className="flex w-[4ch] shrink-0 flex-col justify-between py-px text-right text-graph-muted tabular-nums"
						style={{ height: `${height}em` }}
					>
						<span>{yLabel}</span>
						<span>{formatTick(min)}</span>
					</div>
					<div
						role="img"
						aria-label={
							activeIndex != null
								? `${activeLabel ?? `point ${activeIndex + 1}`} ${formatTick(activeValue)}`
								: `${variant} plot, ${data.length} points, min ${formatTick(min)}, max ${formatTick(max)}`
						}
						tabIndex={0}
						onMouseLeave={() => setActive(null)}
						onBlur={() => setActive(null)}
						onFocus={() => setActive((prev) => prev ?? lastLive)}
						onKeyDown={onPlotKeyDown}
						className="relative flex min-w-0 flex-1 items-end outline-none select-none focus-visible:ring-1 focus-visible:ring-graph-accent"
						style={{ height: `${height}em` }}
					>
						{data.map((value, column) => {
							const level = Math.round(((value - min) / range) * (height - 1));
							const live = column === lastLive && column < revealed;
							const shown = column < revealed;

							return (
								<span
									aria-hidden="true"
									onMouseEnter={() => setActive(column)}
									className="flex h-full min-w-0 flex-1 flex-col justify-end"
									key={column}
								>
									{Array.from({ length: height }, (_, row) => {
										const fromBottom = height - 1 - row;
										const isCap = shown && fromBottom === level;
										const isFill = shown && variant === "area" && fromBottom < level;
										const glyph = isCap ? marks.fill : isFill ? marks.rest : " ";
										const glyphTone = isCap
											? live
												? toneClass(palette, "primary", tone)
												: palette
													? toneClass(palette, "secondary", tone)
													: "text-foreground"
											: isFill
												? toneClass(palette, "secondary", tone)
												: "text-transparent";

										return (
											<motion.span
												className={cn("h-[1em] w-full text-center leading-none", glyphTone)}
												initial={reduce || !shown || glyph === " " ? false : { opacity: 0 }}
												key={row}
												transition={graphTransition(reduce, {
													delay: fillDelay(reduce, column),
												})}
												viewport={{ once: true }}
												whileInView={{ opacity: 1 }}
											>
												{glyph}
											</motion.span>
										);
									})}
								</span>
							);
						})}
						{activeIndex != null ? (
							<span
								aria-hidden="true"
								className="pointer-events-none absolute top-0 graph-rule-y"
								style={{ left: `${activePct}%`, bottom: "-0.75rem" }}
							/>
						) : null}
					</div>
				</div>
				{start || end || activeIndex != null ? (
					<>
						<div className="flex gap-3">
							<span aria-hidden="true" className="invisible w-[4ch] shrink-0 leading-none tabular-nums">
								{yLabel}
							</span>
							<div className="flex min-w-0 flex-1 flex-col gap-1.5">
								<GraphRule className="w-full" />
								{start || end ? (
									<div className="relative -mb-4 flex justify-between px-0.5 leading-none text-graph-muted">
										{cursorLine}
										{tooltip}
										<span className="relative bg-background px-1">{start}</span>
										{end && end !== start ? (
											<span className="relative bg-background px-1">{end}</span>
										) : null}
									</div>
								) : (
									<div aria-hidden="true" className="relative -mb-4 text-xs uppercase">
										{"\u00A0"}
										{cursorLine}
										{tooltip}
									</div>
								)}
							</div>
						</div>
					</>
				) : null}
				<span className="sr-only">
					{variant} plot, {data.length} points, min {formatTick(min)}, max {formatTick(max)}
				</span>
		</>
	);
}

function GraphPlot({ title, corner, className, ...body }: GraphPlotProps) {
	return (
		<Graph title={title} tone={body.tone} className={className} corner={corner}>
			<GraphBody className="flex flex-col gap-3">
				<GraphPlotBody {...body} />
			</GraphBody>
		</Graph>
	);
}

export type { GraphPlotBodyProps, GraphPlotProps };
export { GraphPlot, GraphPlotBody };
