import { IconHeart, IconMenu } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { ColorThemePicker } from "@/components/color-theme-picker";
import { CommandPalette } from "@/components/command-palette";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";

const NAV = [
	{ to: "/leaderboards", label: "Leaderboards" },
	{ to: "/health", label: "Ecosystem Health" },
	{ to: "/categories", label: "Categories" },
	{ to: "/charts", label: "Charts" },
	{ to: "/badges", label: "Badges" },
	{ to: "/competitions", label: "Competitions" },
	{ to: "/about", label: "About" },
] as const;

/** GitHub mark (simple-icons path). */
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

function MobileNav() {
	return (
		<Drawer>
			<DrawerTrigger
				render={<Button variant="ghost" size="icon-sm" aria-label="Menu" className="graph-frame lg:hidden" />}
			>
				<IconMenu className="size-4" />
			</DrawerTrigger>
			<DrawerContent className="mobile-nav-drawer">
				<DrawerHeader>
					<DrawerTitle>Menu</DrawerTitle>
				</DrawerHeader>
				<nav className="flex flex-col gap-1 p-4 pt-2">
					{NAV.map((item) => (
						<DrawerClose
							key={item.to}
							render={
								<Link
									to={item.to}
									activeProps={{ className: "text-graph-accent" }}
									inactiveProps={{ className: "text-muted-foreground" }}
									className="group relative rounded-none px-2.5 py-2.5 font-mono text-xs tracking-wide uppercase transition-colors hover:text-foreground"
								/>
							}
						>
							<span
								aria-hidden="true"
								className="graph-frame graph-frame-march pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-focus-visible:opacity-100 group-hover:opacity-100"
							/>
							{item.label}
						</DrawerClose>
					))}
				</nav>
				<DrawerFooter>
					<a
						href="https://github.com/ussego/omachi"
						target="_blank"
						rel="noreferrer"
						className={buttonVariants({ variant: "ghost", size: "sm", className: "w-full justify-start" })}
					>
						<GithubIcon className="size-4" />
						GitHub
					</a>
					<a
						href="https://github.com/sponsors/ussego"
						target="_blank"
						rel="noreferrer"
						className={buttonVariants({ variant: "ghost", size: "sm", className: "w-full justify-start" })}
					>
						<IconHeart className="size-4" />
						Sponsor
					</a>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}

export default function Header() {
	return (
		<header className="sticky top-0 z-40 shrink-0 bg-background/80 backdrop-blur">
			<div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
				<Link
					to="/"
					aria-label="Omachi — home"
					className="group relative inline-block shrink-0 font-mono text-sm tracking-widest text-graph-accent uppercase"
				>
					<span
						aria-hidden="true"
						className="graph-frame graph-frame-march pointer-events-none absolute -inset-1 opacity-0 transition-opacity duration-200 group-focus-visible:opacity-100 group-hover:opacity-100"
					/>
					<span
						aria-hidden="true"
						className="inline-block -translate-x-0.5 transition-transform duration-200 ease-out group-hover:translate-x-0"
					>
						[{" "}
					</span>
					O
					<span
						aria-hidden="true"
						className="inline-block translate-x-0.5 transition-transform duration-200 ease-out group-hover:translate-x-0"
					>
						{" "}
						]
					</span>
				</Link>
				{/* Keep nav links whitespace-nowrap and hide them below lg: Ecosystem Health only fits in the fixed-height bar at lg. */}
				<nav className="hidden flex-1 items-center gap-1 whitespace-nowrap lg:flex">
					{NAV.map((item) => (
						<Link
							key={item.to}
							to={item.to}
							activeProps={{ className: "text-graph-accent" }}
							inactiveProps={{ className: "text-muted-foreground" }}
							className="group relative rounded-none px-2.5 py-1.5 font-mono text-xs tracking-wide uppercase transition-colors hover:text-foreground"
						>
							<span
								aria-hidden="true"
								className="graph-frame graph-frame-march pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-focus-visible:opacity-100 group-hover:opacity-100"
							/>
							{item.label}
						</Link>
					))}
				</nav>
					<div className="flex flex-1 items-center justify-end gap-1 lg:flex-none">
						<ColorThemePicker />
						<CommandPalette />
					<a
						href="https://github.com/ussego/omachi"
						target="_blank"
						rel="noreferrer"
						aria-label="GitHub repository"
						title="GitHub repository"
						className={buttonVariants({
							variant: "ghost",
							size: "icon-sm",
							className: "graph-frame hidden lg:inline-flex",
						})}
					>
						<GithubIcon className="size-4" />
					</a>
					<a
						href="https://github.com/sponsors/ussego"
						target="_blank"
						rel="noreferrer"
						aria-label="Sponsor on GitHub"
						title="Sponsor on GitHub"
						className={buttonVariants({
							variant: "ghost",
							size: "icon-sm",
							className: "graph-frame hidden lg:inline-flex",
						})}
					>
						<IconHeart className="size-4" />
					</a>
					<MobileNav />
				</div>
			</div>
			<div aria-hidden="true" className="graph-rule-soft absolute inset-x-0 bottom-0" />
		</header>
	);
}
