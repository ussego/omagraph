/** @jsxImportSource react */

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, stripSearchParams, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import type { GraphTone } from "@/components/graph-frame/graph-frame";
import { BrokenPluginsTable } from "@/components/broken-plugins-table";
import { GraphRule } from "@/components/graph-frame/graph-rule";
import { GraphRank } from "@/components/graph-rank";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyTitle } from "@/components/ui/empty";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import { UnverifiedPluginsTable } from "@/components/unverified-plugins-table";

import { breakdownQuery, brokenPluginsQuery, unverifiedPluginsQuery } from "@/lib/queries";
import { pageHead } from "@/lib/site";

const RANGES = [
	{ value: "7d", label: "7d" },
	{ value: "14d", label: "14d" },
	{ value: "30d", label: "1 month" },
] as const;
const DEFAULTS = { range: "30d", page: 1 } as const;
const UNVERIFIED_PAGE_SIZE = 25;

function statusTone(status: string | null): GraphTone {
	const value = status?.toLowerCase() ?? "unknown";
	if (value === "verified" || value === "available" || value === "built in") return "positive";
	if (["broken", "failed", "error", "unavailable"].some((word) => value.includes(word))) return "negative";
	return "warning";
}

// Zod v4 schema passed straight to validateSearch; `.catch` coerces garbage
// to the default instead of erroring the route.
const healthSearchSchema = z.object({
	range: z.enum(["7d", "14d", "30d"]).default(DEFAULTS.range).catch(DEFAULTS.range),
	page: z.number().int().positive().default(DEFAULTS.page).catch(DEFAULTS.page),
});

export const Route = createFileRoute("/health")({
	head: () =>
		pageHead(
			"Omarchy Plugin Ecosystem Health · Omagraph",
			"Review verification status, install availability, stale repositories, failed upstream checks, and recently unverified plugins across the Omarchy catalog.",
			"/health",
		),
	validateSearch: healthSearchSchema,
	search: { middlewares: [stripSearchParams(DEFAULTS)] },
	loaderDeps: ({ search: { range } }) => ({ range }),
	loader: ({ deps, context: { queryClient } }) =>
		Promise.all([
			queryClient.query({ ...breakdownQuery(), staleTime: "static" }),
			queryClient.query({ ...brokenPluginsQuery(), staleTime: "static" }),
			queryClient.query({ ...unverifiedPluginsQuery(deps.range), staleTime: "static" }),
		]),
	component: HealthPage,
});

function StatusChart({ title, rows }: { title: string; rows: { status: string | null; count: number }[] | undefined }) {
	const items = useMemo(
		() =>
			(rows ?? [])
				.map((row) => ({
					label: row.status ?? "unknown",
					value: row.count,
					tone: statusTone(row.status),
				}))
				.sort((left, right) => right.value - left.value),
		[rows],
	);
	if (items.length > 0) {
		return <GraphRank title={title} items={items} className="w-full" />;
	}
	return (
		<Empty>
			<EmptyTitle>No data</EmptyTitle>
		</Empty>
	);
}

function HealthPage() {
	const { range, page } = Route.useSearch();
	const navigate = useNavigate({ from: "/health" });
	const { data: breakdown } = useSuspenseQuery(breakdownQuery());
	const { data: broken } = useSuspenseQuery(brokenPluginsQuery());
	const { data: unverified } = useSuspenseQuery(unverifiedPluginsQuery(range));
	const pageCount = Math.max(1, Math.ceil(unverified.plugins.length / UNVERIFIED_PAGE_SIZE));
	const currentPage = Math.min(page, pageCount);
	const pageStart = (currentPage - 1) * UNVERIFIED_PAGE_SIZE;
	const pagePlugins = unverified.plugins.slice(pageStart, pageStart + UNVERIFIED_PAGE_SIZE);

	return (
		<div className="flex flex-col gap-8">
			<div className="flex max-w-2xl flex-col gap-1">
				<h1 className="font-heading text-2xl">Omarchy Plugin Ecosystem Health</h1>
				<p className="text-muted-foreground text-sm">
					Review catalog verification, install availability, repository freshness, and upstream failures.
				</p>
			</div>

			<div className="flex flex-col gap-12">
				<StatusChart title="INSTALL AVAILABILITY" rows={breakdown.installStatus} />
				<StatusChart title="VERIFICATION STATUS" rows={breakdown.verification} />
			</div>

			<GraphRule />

			<div className="flex flex-col gap-3">
				<h2 className="font-heading text-xl">Broken plugins</h2>
				<p className="text-muted-foreground text-sm">
					Unreachable/failed upstream, or repository untouched for &gt;{broken.staleDays} days
				</p>
				<BrokenPluginsTable plugins={broken.plugins} />
			</div>

			<GraphRule />

			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<h2 className="font-heading text-xl">Unverified plugins</h2>
					<Tabs
						value={range}
						onValueChange={(v) =>
							navigate({ search: (prev) => ({ ...prev, range: v as typeof range, page: DEFAULTS.page }) })
						}
					>
						<TabsList>
							{RANGES.map((r) => (
								<TabsTab key={r.value} value={r.value}>
									{r.label}
								</TabsTab>
							))}
						</TabsList>
					</Tabs>
				</div>
				<UnverifiedPluginsTable plugins={pagePlugins} />
				{unverified.plugins.length > UNVERIFIED_PAGE_SIZE ? (
					<div className="flex flex-col items-center gap-2">
						<p className="font-mono text-muted-foreground text-xs uppercase tabular-nums">
							Showing {pageStart + 1}–
							{Math.min(pageStart + UNVERIFIED_PAGE_SIZE, unverified.plugins.length)} of{" "}
							{unverified.plugins.length}
						</p>
						<Pagination>
							<PaginationContent>
								<PaginationItem>
									{currentPage > 1 ? (
										<PaginationPrevious
											className={buttonVariants({ variant: "ghost", size: "default" })}
											render={
												<Link
													from="/health"
													resetScroll={false}
													to="/health"
													search={(prev) => ({ ...prev, page: currentPage - 1 })}
												/>
											}
										/>
									) : (
										<PaginationPrevious aria-disabled className="pointer-events-none opacity-50" />
									)}
								</PaginationItem>
								<PaginationItem>
									<span className="flex h-8 items-center px-2 font-mono text-xs uppercase tabular-nums">
										Page {currentPage} of {pageCount}
									</span>
								</PaginationItem>
								<PaginationItem>
									{currentPage < pageCount ? (
										<PaginationNext
											className={buttonVariants({ variant: "ghost", size: "default" })}
											render={
												<Link
													from="/health"
													resetScroll={false}
													to="/health"
													search={(prev) => ({ ...prev, page: currentPage + 1 })}
												/>
											}
										/>
									) : (
										<PaginationNext aria-disabled className="pointer-events-none opacity-50" />
									)}
								</PaginationItem>
							</PaginationContent>
						</Pagination>
					</div>
				) : null}
			</div>
		</div>
	);
}
