/** @jsxImportSource react */

import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";

import { GraphCorners } from "@/components/graph-frame/graph-frame";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { pageHead } from "@/lib/site";

const TOKEN_KEY = "admin-token";

export const Route = createFileRoute("/admin")({
	head: () => pageHead("Admin · Omachi", "Competition administration.", "/admin", true),
	component: AdminPage,
});

async function post(path: string, token: string, body: unknown) {
	const response = await fetch(path, {
		method: "POST",
		headers: { "content-type": "application/json", "x-admin-token": token },
		body: JSON.stringify(body),
	});
	const result = (await response.json()) as { error?: string };
	if (!response.ok) throw new Error(result.error ?? `request failed (${response.status})`);
}

function AdminPanel({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="graph-frame relative">
			<GraphCorners />
			<div className="flex flex-col gap-5 px-5 py-7 sm:px-8 sm:py-8">
				<h2 className="font-heading text-lg">{title}</h2>
				{children}
			</div>
		</section>
	);
}

function AdminPage() {
	const [token, setToken] = useState("");
	const [pending, setPending] = useState(false);
	const [competitionStatus, setCompetitionStatus] = useState("");
	const [placementStatus, setPlacementStatus] = useState("");

	useEffect(() => setToken(window.localStorage.getItem(TOKEN_KEY) ?? ""), []);

	async function submitCompetition(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const data = new FormData(form);
		setPending(true);
		setCompetitionStatus("");
		try {
			await post("/api/admin/competitions", token, {
				id: String(data.get("id") ?? ""),
				title: String(data.get("title") ?? ""),
				announcedAt: String(data.get("announcedAt") ?? ""),
				announcementUrl: String(data.get("announcementUrl") ?? ""),
			});
			form.reset();
			setCompetitionStatus("Competition saved.");
		} catch (error) {
			setCompetitionStatus(error instanceof Error ? error.message : "request failed");
		} finally {
			setPending(false);
		}
	}

	async function submitPlacement(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const data = new FormData(form);
		const prize = String(data.get("prize") ?? "");
		setPending(true);
		setPlacementStatus("");
		try {
			await post("/api/admin/placements", token, {
				competitionId: String(data.get("competitionId") ?? ""),
				pluginId: String(data.get("pluginId") ?? ""),
				place: Number(data.get("place")),
				prize: prize ? Number(prize) : null,
			});
			form.reset();
			setPlacementStatus("Placement saved.");
		} catch (error) {
			setPlacementStatus(error instanceof Error ? error.message : "request failed");
		} finally {
			setPending(false);
		}
	}

	return (
		<div className="flex flex-col gap-8">
			<h1 className="font-heading text-2xl">Competition admin</h1>

			<div className="max-w-xl">
				<AdminPanel title="Access">
					<Field>
						<FieldLabel htmlFor="admin-token">Admin token</FieldLabel>
						<Input
							id="admin-token"
							type="password"
							autoComplete="current-password"
							value={token}
							onChange={(event) => {
								setToken(event.target.value);
								window.localStorage.setItem(TOKEN_KEY, event.target.value);
							}}
						/>
					</Field>
				</AdminPanel>
			</div>

			<div className="grid gap-8 lg:grid-cols-2">
				<AdminPanel title="New competition">
					<form onSubmit={submitCompetition} aria-busy={pending}>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="competition-id">ID</FieldLabel>
								<Input id="competition-id" name="id" placeholder="comp-02" required />
							</Field>
							<Field>
								<FieldLabel htmlFor="competition-title">Title</FieldLabel>
								<Input id="competition-title" name="title" required />
							</Field>
							<Field>
								<FieldLabel htmlFor="competition-announced-at">Announced at</FieldLabel>
								<Input id="competition-announced-at" name="announcedAt" type="date" required />
							</Field>
							<Field>
								<FieldLabel htmlFor="competition-announcement-url">Announcement URL</FieldLabel>
								<Input id="competition-announcement-url" name="announcementUrl" type="url" required />
							</Field>
							<Button type="submit" disabled={pending || !token}>
								Create competition
							</Button>
							<p role="status" className="min-h-5 text-muted-foreground" aria-live="polite">
								{competitionStatus}
							</p>
						</FieldGroup>
					</form>
				</AdminPanel>

				<AdminPanel title="New placement">
					<form onSubmit={submitPlacement} aria-busy={pending}>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="placement-competition-id">Competition ID</FieldLabel>
								<Input id="placement-competition-id" name="competitionId" required />
							</Field>
							<Field>
								<FieldLabel htmlFor="placement-plugin-id">Plugin ID</FieldLabel>
								<Input id="placement-plugin-id" name="pluginId" required />
							</Field>
							<Field>
								<FieldLabel htmlFor="placement-place">Place</FieldLabel>
								<Input id="placement-place" name="place" type="number" min="0" required />
							</Field>
							<Field>
								<FieldLabel htmlFor="placement-prize">Prize USD</FieldLabel>
								<Input id="placement-prize" name="prize" type="number" min="0" />
							</Field>
							<Button type="submit" disabled={pending || !token}>
								Create placement
							</Button>
							<p role="status" className="min-h-5 text-muted-foreground" aria-live="polite">
								{placementStatus}
							</p>
						</FieldGroup>
					</form>
				</AdminPanel>
			</div>
		</div>
	);
}
