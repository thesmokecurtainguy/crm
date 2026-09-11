"use client";

import { Button } from "@crm/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

const PLACEHOLDERS = [
	["firstName", "the contact's first name"],
	["lastName", "last name"],
	["fullName", "first and last"],
	["title", "their title"],
	["firm", "their company"],
	["firmCity", "company city, state"],
	["project", "project name"],
	["city", "project city"],
	["state", "project state"],
	["stage", "design stage"],
	["value", "project value"],
	["floors", "floors"],
	["bidDate", "quote bid date"],
	["gc", "general contractor"],
	["architect", "architect firm"],
	["today", "today's date"],
] as const;

type Draft = {
	id: string | null;
	name: string;
	description: string;
	subject: string;
	body: string;
};

const EMPTY: Draft = {
	id: null,
	name: "",
	description: "",
	subject: "",
	body: "",
};

export function TemplatesEditor() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const templates = useQuery(
		trpc.templates.list.queryOptions({ includeArchived: false }),
	);
	const [draft, setDraft] = useState<Draft>(EMPTY);

	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: trpc.templates.list.queryKey() });

	const create = useMutation(
		trpc.templates.create.mutationOptions({
			onSuccess: async (row) => {
				await refresh();
				setDraft({
					id: row.id,
					name: row.name,
					description: row.description ?? "",
					subject: row.subject,
					body: row.body,
				});
				toast.success("Template saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const update = useMutation(
		trpc.templates.update.mutationOptions({
			onSuccess: async () => {
				await refresh();
				toast.success("Template saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const archive = useMutation(
		trpc.templates.archive.mutationOptions({
			onSuccess: async () => {
				await refresh();
				setDraft(EMPTY);
				toast.success("Template archived.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	useEffect(() => {
		if (draft.id === null && templates.data?.[0] && !draft.name) {
			const t = templates.data[0];
			setDraft({
				id: t.id,
				name: t.name,
				description: t.description ?? "",
				subject: t.subject,
				body: t.body,
			});
		}
	}, [templates.data, draft.id, draft.name]);

	const busy = create.isPending || update.isPending || archive.isPending;
	const ready = draft.name.trim() && draft.subject.trim() && draft.body.trim();

	const save = () => {
		const data = {
			name: draft.name.trim(),
			description: draft.description.trim() || null,
			subject: draft.subject.trim(),
			body: draft.body,
		};
		if (draft.id) update.mutate({ id: draft.id, data });
		else create.mutate(data);
	};

	return (
		<div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
			<div className="space-y-2">
				<Button
					size="sm"
					variant="outline"
					className="w-full"
					onClick={() => setDraft(EMPTY)}
				>
					New template
				</Button>
				<ul className="divide-y rounded-md border">
					{(templates.data ?? []).map((t) => (
						<li key={t.id}>
							<button
								type="button"
								className={`w-full px-3 py-2 text-left text-sm hover:bg-accent ${
									draft.id === t.id ? "bg-accent" : ""
								}`}
								onClick={() =>
									setDraft({
										id: t.id,
										name: t.name,
										description: t.description ?? "",
										subject: t.subject,
										body: t.body,
									})
								}
							>
								<div className="truncate font-medium">{t.name}</div>
								{t.description ? (
									<div className="truncate text-muted-foreground text-xs">
										{t.description}
									</div>
								) : null}
							</button>
						</li>
					))}
				</ul>
				<div className="rounded-md border p-3 text-xs">
					<div className="mb-1 font-medium">Placeholders</div>
					<ul className="space-y-0.5 text-muted-foreground">
						{PLACEHOLDERS.map(([key, what]) => (
							<li key={key}>
								<code>{`{{${key}}}`}</code> — {what}
							</li>
						))}
					</ul>
					<div className="mt-2 text-muted-foreground">
						Optional piece: <code>{"{{#city}} in {{city}}{{/city}}"}</code>
					</div>
				</div>
			</div>

			<FieldGroup>
				<div className="grid gap-3 sm:grid-cols-2">
					<Field>
						<FieldLabel>Name</FieldLabel>
						<Input
							value={draft.name}
							onChange={(e) => setDraft({ ...draft, name: e.target.value })}
						/>
					</Field>
					<Field>
						<FieldLabel>When to use it</FieldLabel>
						<Input
							value={draft.description}
							onChange={(e) =>
								setDraft({ ...draft, description: e.target.value })
							}
							placeholder="First email to a project architect"
						/>
						<FieldDescription>
							The agent reads this to pick the right one.
						</FieldDescription>
					</Field>
				</div>
				<Field>
					<FieldLabel>Subject</FieldLabel>
					<Input
						value={draft.subject}
						onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
					/>
				</Field>
				<Field>
					<FieldLabel>Body</FieldLabel>
					<Textarea
						rows={18}
						value={draft.body}
						onChange={(e) => setDraft({ ...draft, body: e.target.value })}
						className="font-sans"
					/>
				</Field>
				<div className="flex items-center gap-2">
					<Button onClick={save} disabled={!ready || busy}>
						{busy ? <Spinner data-icon="inline-start" /> : null}
						{draft.id ? "Save" : "Create"}
					</Button>
					{draft.id ? (
						<Button
							variant="ghost"
							disabled={busy}
							onClick={() => draft.id && archive.mutate({ id: draft.id })}
						>
							Archive
						</Button>
					) : null}
				</div>
			</FieldGroup>
		</div>
	);
}
