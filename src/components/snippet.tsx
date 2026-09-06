/** @jsxImportSource react */
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { highlight, type LanguageName } from "sugar-high";

import { Button } from "@/components/ui/button";
import { GraphCorners } from "@/components/graph-frame/graph-frame";
import { ScrollArea } from "@/components/ui/scroll-area";

/** Button that copies `text` and flashes a check for 1.5s. */
export function CopyButton({
	text,
	label = "Copy URL",
	showLabel = false,
	className,
	size = "icon-sm",
}: {
	text: string;
	label?: string;
	showLabel?: boolean;
	className?: string;
	size?: "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
}) {
	const [copied, setCopied] = useState(false);
	useEffect(() => {
		if (!copied) return;
		const t = setTimeout(() => setCopied(false), 1500);
		return () => clearTimeout(t);
	}, [copied]);
	return (
		<Button
			variant="ghost"
			size={size}
			className={className}
			title={copied ? "Copied" : label}
			onClick={() => {
				navigator.clipboard.writeText(text);
				setCopied(true);
			}}
		>
			{copied ? <IconCheck className="text-green-600" /> : <IconCopy />}
			{showLabel && (copied ? "copied" : "copy")}
		</Button>
	);
}

export function Code({ children }: { children: string }) {
	return <code className="bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>;
}

const METHOD_RE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)(\s+)/;

/** Splits a leading HTTP method off route lines so it gets its own color. */
function highlightWithMethod(children: string, lang: LanguageName): string {
	if (lang !== "plaintext") return highlight(children, { lang });
	const m = METHOD_RE.exec(children);
	if (!m) return highlight(children, { lang });
	return `<span style="color:var(--sh-method)">${m[1]}</span>${highlight(children.slice(m[1].length), { lang })}`;
}

export function Snippet({ children, lang = "plaintext" }: { children: string; lang?: LanguageName }) {
	return (
		<div className="relative bg-muted/30 graph-frame p-4">
			<GraphCorners />
			<ScrollArea className="snippet-scroll">
				<pre className="w-max min-w-full font-mono text-sm">
					{/* biome-ignore lint/security/noDangerouslySetInnerHtml: sugar-high escapes HTML in token values. */}
					<code dangerouslySetInnerHTML={{ __html: highlightWithMethod(children, lang) }} />
				</pre>
			</ScrollArea>
		</div>
	);
}
