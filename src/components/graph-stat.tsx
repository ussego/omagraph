"use client";

import { motion, useReducedMotion } from "motion/react";

import { Graph, GraphBody, type GraphTone } from "@/components/graph-frame/graph-frame";
import { fadeUp, graphToneClass, staggerList } from "@/components/graph-frame/graph-motion";
import { cn } from "@/lib/utils";

const columnClass: Record<number, string> = {
	1: "sm:grid-cols-1",
	2: "sm:grid-cols-2",
	3: "sm:grid-cols-3",
	4: "sm:grid-cols-4",
};

type StatItem = {
	value: string;
	label: string;
	hint?: string;
	accent?: boolean;
	tone?: GraphTone;
};

type GraphStatProps = {
	title: string;
	items: StatItem[];
	layout?: "grid" | "stack";
	tone?: GraphTone;
	corner?: string;
	className?: string;
};

function GraphStat({ title, items, layout = "grid", tone, corner, className }: GraphStatProps) {
	const reduce = useReducedMotion();
	const item = fadeUp(reduce);
	const list = staggerList(reduce, 0.06);
	const columns = Math.min(items.length, 4);

	return (
		<Graph title={title} tone={tone} className={className} corner={corner}>
			<GraphBody>
				<motion.ul
					className={cn(
						layout === "stack" ? "flex flex-col gap-8" : "grid gap-8",
						layout === "grid" && columnClass[columns],
					)}
					initial={reduce ? false : "hidden"}
					role="list"
					variants={list}
					viewport={{ once: true, amount: 0.5 }}
					whileInView="show"
				>
					{items.map((entry, index) => (
						<motion.li className="flex flex-col gap-2" key={index} variants={item}>
							<p
								className={cn(
									"text-3xl tracking-tight tabular-nums sm:text-4xl",
									entry.tone
										? graphToneClass(entry.tone)
										: entry.accent
											? "text-graph-accent"
											: "text-foreground",
								)}
							>
								{entry.value}
							</p>
							<p className="text-graph-muted">{entry.label}</p>
							{entry.hint ? <p className="text-graph-muted">{entry.hint}</p> : null}
						</motion.li>
					))}
				</motion.ul>
			</GraphBody>
		</Graph>
	);
}

export type { GraphStatProps, StatItem };
export { GraphStat };
