"use client";

import { motion, useReducedMotion } from "motion/react";

import {
	Graph,
	GraphBody,
	GraphTick,
	GraphTrack,
	type GraphTone,
} from "@/components/graph-frame/graph-frame";
import {
	fadeUp,
	type Glyphs,
	type GraphPalette,
	graphTransition,
	toneClass,
	trackMarks,
} from "@/components/graph-frame/graph-motion";

type RankItem = {
	label: string;
	value: number;
	display?: string;
	tone?: GraphTone;
};

type GraphRankProps = {
	title: string;
	items: RankItem[];
	max?: number;
	ticks?: number;
	glyphs?: Glyphs;
	palette?: GraphPalette;
	tone?: GraphTone;
	corner?: string;
	className?: string;
};

function formatValue(item: RankItem) {
	if (item.display) {
		return item.display;
	}

	return item.value.toLocaleString("en-US", {
		maximumFractionDigits: Number.isInteger(item.value) ? 0 : 1,
	});
}

function GraphRank({ title, items, max, ticks = 20, glyphs, palette, tone, corner, className }: GraphRankProps) {
	const reduce = useReducedMotion();
	const item = fadeUp(reduce);
	const peak = max ?? Math.max(...items.map((entry) => entry.value), 1);
	const marks = trackMarks(glyphs, {
		empty: "-",
		rest: "=",
		fill: "=",
	});

	return (
		<Graph title={title} tone={tone} className={className} corner={corner}>
			<GraphBody className="flex flex-col gap-3">
				<ol className="flex w-full list-none flex-col gap-2">
					{items.map((entry, index) => {
						const raw = Math.round((Math.max(entry.value, 0) / peak) * ticks);
						// Nonzero rows always get at least one mark so small
						// values never read as an empty track.
						const filled = entry.value > 0 ? Math.max(1, Math.min(ticks, raw)) : 0;
						const shown = formatValue(entry);

						return (
							<motion.li
								aria-label={`${entry.label} ${shown}`}
								className="grid grid-cols-[5rem_minmax(0,1fr)_5rem] items-center gap-x-4 sm:grid-cols-[7rem_minmax(0,1fr)_7rem]"
								animate="show"
								initial={reduce ? false : "hidden"}
								key={entry.label}
								transition={graphTransition(reduce, { delay: Math.min(index * 0.05, 0.8) })}
								variants={item}
							>
								<span className="truncate text-foreground">{entry.label}</span>
								<span className="flex min-w-0 items-center">
									<span aria-hidden="true" className="text-graph-frame select-none">
										[
									</span>
									<GraphTrack>
										{Array.from({ length: ticks }, (_, index) => {
											const on = index < filled;

											return (
												<GraphTick
													className={
														on
															? toneClass(palette, "primary", entry.tone ?? tone)
															: "text-graph-frame"
													}
													key={index}
												>
													{on ? marks.fill : marks.empty}
												</GraphTick>
											);
										})}
									</GraphTrack>
									<span aria-hidden="true" className="text-graph-frame select-none">
										]
									</span>
								</span>
								<span className="text-right text-graph-muted tabular-nums">{shown}</span>
							</motion.li>
						);
					})}
				</ol>
			</GraphBody>
		</Graph>
	);
}

export type { GraphRankProps, RankItem };
export { GraphRank };
