/** @jsxImportSource react */

import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import type React from "react";

import { Graph, GraphBody } from "@/components/graph-frame/graph-frame";

/**
 * Full-page error state: a dashed blueprint frame carrying the status code as
 * its `[ CODE ]` caption, a sans heading, muted copy, and mono uppercase
 * actions. Used by the root route for not-found and unhandled-error states.
 */
export function ErrorPage({
	code = "error",
	title,
	description,
	children,
}: {
	/** The frame caption, e.g. "404" or "500". */
	code?: string;
	title: string;
	description?: string;
	children?: React.ReactNode;
}): React.ReactElement {
	return (
		<div className="flex min-h-[45dvh] items-center justify-center py-4 sm:py-8">
			<Graph title={code} className="w-full max-w-xl">
				<GraphBody className="flex flex-col items-center gap-6 text-center">
					<div className="flex flex-col items-center gap-2">
						<h1 className="font-heading text-balance text-2xl">{title}</h1>
						{description ? (
							<p className="max-w-md text-pretty text-sm text-muted-foreground">{description}</p>
						) : null}
					</div>
					<div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
						{children ?? (
							<Link
								to="/"
								className="font-mono text-xs tracking-wide text-graph-accent uppercase transition-colors hover:text-foreground"
							>
								back to overview
							</Link>
						)}
					</div>
				</GraphBody>
			</Graph>
		</div>
	);
}

/** Root-route state for unmatched paths (the automatic 404). */
export function NotFoundState() {
	useEffect(() => {
		document.title = "404 · Omagraph";
	}, []);

	return (
		<ErrorPage
			code="404"
			title="Page not found"
			description="The page you're after doesn't exist or has moved. Check the address, or head back to the overview."
		/>
	);
}

/**
 * Router-wide state for unhandled errors. Also the `defaultErrorComponent`,
 * so it covers SSR loader errors (which render per-route) and hydration.
 */
export function ErrorState({ error }: ErrorComponentProps) {
	const router = useRouter();
	useEffect(() => {
		document.title = "500 · Omagraph";
	}, []);

	return (
		<ErrorPage
			code="500"
			title="Something went wrong"
			description="An unexpected error occurred while rendering this page. Try again — if it keeps failing, the upstream catalog feed may be having issues."
		>
			{import.meta.env.DEV ? <p className="font-mono text-xs text-graph-muted">{error.message}</p> : null}
			<button
				type="button"
				onClick={() => {
					// Invalidate re-runs every loader and resets the error boundary.
					router.invalidate();
				}}
				className="cursor-pointer font-mono text-xs tracking-wide text-graph-accent uppercase transition-colors hover:text-foreground"
			>
				try again
			</button>
			<Link
				to="/"
				className="font-mono text-xs tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
			>
				back to overview
			</Link>
		</ErrorPage>
	);
}
