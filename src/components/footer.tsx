import { IconHeart } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { GraphCorners } from "@/components/graph-frame/graph-frame";
import { buttonVariants } from "@/components/ui/button";

function GithubIcon({ className }: { className?: string }) {
	return (
		<svg
			fill="currentColor"
			fillRule="evenodd"
			height="1em"
			style={{ flex: "none", lineHeight: 1 }}
			viewBox="0 0 24 24"
			width="1em"
			className={className}
			aria-hidden="true"
		>
			<path d="M12 0c6.63 0 12 5.276 12 11.79-.001 5.067-3.29 9.567-8.175 11.187-.6.118-.825-.25-.825-.56 0-.398.015-1.665.015-3.242 0-1.105-.375-1.813-.81-2.181 2.67-.295 5.475-1.297 5.475-5.822 0-1.297-.465-2.344-1.23-3.169.12-.295.54-1.503-.12-3.125 0 0-1.005-.324-3.3 1.209a11.32 11.32 0 00-3-.398c-1.02 0-2.04.133-3 .398-2.295-1.518-3.3-1.209-3.3-1.209-.66 1.622-.24 2.83-.12 3.125-.765.825-1.23 1.887-1.23 3.169 0 4.51 2.79 5.527 5.46 5.822-.345.294-.66.81-.765 1.577-.69.31-2.415.81-3.495-.973-.225-.354-.9-1.223-1.845-1.209-1.005.015-.405.56.015.781.51.28 1.095 1.327 1.23 1.666.24.663 1.02 1.93 4.035 1.385 0 .988.015 1.916.015 2.196 0 .31-.225.664-.825.56C3.303 21.374-.003 16.867 0 11.791 0 5.276 5.37 0 12 0z" />
		</svg>
	);
}

export default function Footer() {
	return (
		<footer className="shrink-0 overflow-x-clip">
			<div className="relative">
				<div aria-hidden="true" className="graph-rule-soft" />
				<div className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-px w-full max-w-6xl">
					<GraphCorners corners={["tl", "tr"]} ink="text-graph-frame-soft" className="hidden xl:flex" />
				</div>
			</div>
			<div className="graph-frame-sides mx-auto w-full max-w-6xl px-4 pt-8 pb-10 sm:px-6">
				<div className="flex w-full flex-wrap items-end justify-between gap-3">
					<div className="flex flex-col">
						<span className="font-mono text-sm tracking-widest text-graph-accent uppercase">[O]</span>
						<span className="text-muted-foreground text-sm">
							Omagraph is an independent companion dashboard for the Omarchy plugin catalog
						</span>
					</div>
					<div className="flex flex-wrap items-end justify-end gap-x-5 gap-y-3">
						<nav aria-label="Footer" className="flex items-center gap-3">
							<Link
								to="/about"
								className="font-mono text-muted-foreground text-xs transition-colors hover:text-foreground"
							>
								About
							</Link>
							<span aria-hidden="true" className="font-mono text-muted-foreground text-xs">
								·
							</span>
							<Link
								to="/api-docs"
								className="font-mono text-muted-foreground text-xs transition-colors hover:text-foreground"
							>
								API Docs
							</Link>
						</nav>
						<div className="flex items-center gap-1">
							<a
								href="https://github.com/ussego/omagraph"
								target="_blank"
								rel="noreferrer"
								aria-label="GitHub repository"
								title="GitHub repository"
								className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
							>
								<GithubIcon className="size-4" />
							</a>
							<a
								href="https://github.com/sponsors/ussego"
								target="_blank"
								rel="noreferrer"
								aria-label="Sponsor on GitHub"
								title="Sponsor on GitHub"
								className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
							>
								<IconHeart className="size-4" />
							</a>
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}
