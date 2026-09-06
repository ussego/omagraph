"use client";

import * as React from "react";

import { graphToneClass, type GraphTone } from "@/components/graph-frame/graph-motion";
import { cn } from "@/lib/utils";

type Corner = "tl" | "tr" | "bl" | "br";

const CORNER_POSITIONS: Record<Corner, string> = {
	tl: "top-0 left-px -translate-x-1/2 -translate-y-1/2",
	tr: "top-0 right-0 translate-x-1/2 -translate-y-1/2",
	bl: "bottom-px left-px -translate-x-1/2 translate-y-1/2",
	br: "right-0 bottom-px translate-x-1/2 translate-y-1/2",
};

function GraphCorners({
	mark = "+",
	ink = "text-graph-frame",
	corners = ["tl", "tr", "bl", "br"],
	className,
}: {
	mark?: string;
	ink?: string;
	/** Which corners get marks; defaults to all four. */
	corners?: Corner[];
	className?: string;
}) {
	const corner = cn(
		"pointer-events-none absolute z-10 flex size-3 items-center justify-center font-mono text-sm leading-none select-none",
		ink,
		className,
	);

	return (
		<>
			{corners.map((c) => (
				<span key={c} aria-hidden="true" className={cn(corner, CORNER_POSITIONS[c])}>
					<span
						aria-hidden="true"
						className="absolute top-1/2 left-1/2 z-0 size-4 -translate-x-1/2 -translate-y-1/2 bg-background"
					/>
					<span className="relative z-10">{mark}</span>
				</span>
			))}
		</>
	);
}

function GraphTitle({
	className,
	children,
	tone,
	...props
}: React.ComponentProps<"figcaption"> & { tone?: GraphTone }) {
	return (
		<figcaption
			className={cn(
				"absolute top-0 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 bg-background px-2.5 tracking-wide whitespace-nowrap uppercase",
				className,
			)}
			{...props}
		>
			<span className={cn("graph-title-ink", graphToneClass(tone))}>[ {children} ]</span>
		</figcaption>
	);
}

function GraphBody({ className, ...props }: React.ComponentProps<"div">) {
	return <div className={cn("px-5 py-7 sm:px-8 sm:py-8", className)} {...props} />;
}

function GraphRule({ className, ...props }: React.ComponentProps<"div">) {
	return <div aria-hidden="true" className={cn("graph-rule w-full", className)} {...props} />;
}

function GraphTrack({ className, ...props }: React.ComponentProps<"span">) {
	return <span aria-hidden="true" className={cn("flex w-full min-w-0 select-none", className)} {...props} />;
}

function GraphTick({ className, ...props }: React.ComponentProps<"span">) {
	return <span className={cn("min-w-0 flex-1 overflow-hidden text-center", className)} {...props} />;
}

function Graph({
	title,
	tone,
	corner = "+",
	className,
	children,
	...props
}: React.ComponentProps<"figure"> & {
	title?: string;
	tone?: GraphTone;
	corner?: string;
}) {
	const captionId = React.useId();

	return (
		<figure
			aria-labelledby={title ? captionId : undefined}
			className={cn("relative min-w-0 graph-frame font-mono text-sm text-foreground", className)}
			{...props}
		>
			{title ? (
				<GraphTitle id={captionId} tone={tone}>
					{title}
				</GraphTitle>
			) : null}
			<GraphCorners mark={corner} />
			{children}
		</figure>
	);
}

export { Graph, GraphBody, GraphCorners, GraphRule, GraphTick, GraphTitle, GraphTrack };
export type { Corner, GraphTone };
