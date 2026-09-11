import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import Footer from "@/components/footer";
import { NotFoundState } from "@/components/error-page";
import Header from "@/components/header";
import TanStackQueryDevtools from "@/integrations/tanstack-query/devtools";
import { SITE_DESC, SITE_TITLE, SITE_URL } from "@/lib/site";
import appCss from "@/styles.css?url";
import themesCss from "@/themes/themes.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

const THEME_CSS_HREF = JSON.stringify(themesCss);

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;var palette=window.localStorage.getItem('color-theme');if(palette&&palette!=='omagraph'&&palette!=='omachi'){root.setAttribute('data-color-theme',palette);var link=document.createElement('link');link.rel='stylesheet';link.href=${THEME_CSS_HREF};document.head.appendChild(link)}else{root.removeAttribute('data-color-theme')}}catch(e){}})();`;

export const Route = createRootRouteWithContext<MyRouterContext>()({
	// Workers Free allows 10ms CPU per invocation; SSR of data-heavy pages
	// exceeds it and answers 503 ("Worker exceeded CPU time limit"). Pages
	// render client-side against the edge-cached API; `/` and `/about` opt
	// back into SSR with `ssr: true` because their SSR fits the budget.
	ssr: false,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: SITE_TITLE },
			{ name: "description", content: SITE_DESC },
			{ property: "og:type", content: "website" },
			{ property: "og:site_name", content: "Omagraph" },
			{ property: "og:title", content: SITE_TITLE },
			{ property: "og:description", content: SITE_DESC },
			{ property: "og:url", content: SITE_URL },
			{ property: "og:image", content: `${SITE_URL}/og.png` },
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:title", content: SITE_TITLE },
			{ name: "twitter:description", content: SITE_DESC },
			{ name: "twitter:image", content: `${SITE_URL}/og.png` },
		],
		links: [
			{ rel: "icon", href: "/favicon.ico", sizes: "any" },
			{ rel: "icon", type: "image/png", href: "/favicon.png" },
			{ rel: "stylesheet", href: appCss },
		],
	}),
	shellComponent: RootDocument,
	notFoundComponent: NotFoundState,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				{/* Static, trusted theme bootstrap prevents a flash before React hydrates. */}
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: static trusted theme initialization */}
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
				<HeadContent />
				{/* Cloudflare Web Analytics */}
				<script
					type="module"
					src="https://static.cloudflareinsights.com/beacon.min.js"
					data-cf-beacon='{"token": "529e707d35cd495fade1f40fab7a9a34"}'
				/>
			</head>
			<body className="font-sans antialiased wrap-anywhere">
				<Header />
				<main className="flex min-h-[calc(100dvh-3.5rem)] flex-col">
					{/* overflow-x-clip: corner marks overhang 8px and must not scroll the
				    page while the column is wider than max-w-6xl (640-1168px). */}
					<div className="graph-frame-sides relative mx-auto w-full max-w-6xl flex-1 overflow-x-clip">
						<div className="px-4 py-8 sm:px-6">{children}</div>
					</div>
					<Footer />
				</main>
				<TanStackDevtools
					config={{ position: "bottom-right" }}
					plugins={[
						{ name: "TanStack Router", render: <TanStackRouterDevtoolsPanel /> },
						TanStackQueryDevtools,
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
