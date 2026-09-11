"use client";

import { Button } from "@crm/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@crm/ui/components/dialog";
import { Field, FieldDescription, FieldLabel } from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CompanyPicker } from "@/components/crm/company-picker";
import {
	ContactSearch,
	type PickedContact,
} from "@/components/crm/contact-search";
import { useTRPC } from "@/lib/trpc/client";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export type MergeKind = "contact" | "company" | "project";

const NOUN: Record<MergeKind, string> = {
	contact: "contact",
	company: "company",
	project: "project",
};

export function MergeDialog({
	open,
	onOpenChange,
	kind,
	keepId,
	keepName,
	presetMergeId,
	presetMergeName,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	kind: MergeKind;
	keepId: string;
	keepName: string;
	presetMergeId?: string;
	presetMergeName?: string;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();
	const [mergeId, setMergeId] = useState(presetMergeId ?? "");
	const [mergeName, setMergeName] = useState(presetMergeName ?? "");
	const [projectQuery, setProjectQuery] = useState("");

	const procedure =
		kind === "contact"
			? trpc.contacts.merge
			: kind === "company"
				? trpc.companies.merge
				: trpc.projects.merge;

	const merge = useMutation(
		procedure.mutationOptions({
			onSuccess: async (result) => {
				const total = Object.values(result.moved).reduce((a, b) => a + b, 0);
				toast.success(`Merged. ${total} linked items moved onto ${keepName}.`);
				await queryClient.invalidateQueries();
				onOpenChange(false);
				if (kind === "project")
					router.replace(workspaceUrl(`/projects/${keepId}`));
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Merge into {keepName}</DialogTitle>
					<DialogDescription>
						Everything on the other {NOUN[kind]} — notes, emails, meetings,
						quotes, people, history — moves onto this one. Blank fields here are
						filled from the other. The other record is archived with a note
						pointing back. This can't be undone.
					</DialogDescription>
				</DialogHeader>
				<Field>
					<FieldLabel>
						{NOUN[kind][0]?.toUpperCase()}
						{NOUN[kind].slice(1)} to fold in
					</FieldLabel>
					{kind === "company" ? (
						<CompanyPicker
							id="merge-company"
							value={mergeId}
							onValueChange={(value) => {
								setMergeId(value);
								setMergeName("");
							}}
							placeholder="Search the duplicate company"
						/>
					) : kind === "contact" ? (
						<div className="flex items-center gap-2">
							<ContactSearch
								label={mergeName || "Pick the duplicate"}
								onPick={(contact: PickedContact) => {
									setMergeId(contact.id);
									setMergeName(contact.name);
								}}
							/>
						</div>
					) : (
						<ProjectPicker
							value={mergeId}
							label={mergeName}
							query={projectQuery}
							onQuery={setProjectQuery}
							onPick={(id, name) => {
								setMergeId(id);
								setMergeName(name);
							}}
							excludeId={keepId}
						/>
					)}
					<FieldDescription>
						You keep <strong>{keepName}</strong>. The one you pick here goes
						away.
					</FieldDescription>
				</Field>
				<div className="flex justify-end gap-2">
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						disabled={!mergeId || mergeId === keepId || merge.isPending}
						onClick={() => merge.mutate({ keepId, mergeId })}
					>
						{merge.isPending ? <Spinner data-icon="inline-start" /> : null}
						Merge
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function ProjectPicker({
	value,
	label,
	query,
	onQuery,
	onPick,
	excludeId,
}: {
	value: string;
	label: string;
	query: string;
	onQuery: (q: string) => void;
	onPick: (id: string, name: string) => void;
	excludeId: string;
}) {
	const trpc = useTRPC();
	const projects = useQuery({
		...trpc.projects.list.queryOptions({ q: query, pageSize: 8 }),
		enabled: query.length > 1,
	});
	return (
		<div className="space-y-2">
			<Input
				placeholder="Type part of the project name"
				value={query}
				onChange={(e) => onQuery(e.target.value)}
			/>
			{value && label ? (
				<p className="text-sm">
					Selected: <strong>{label}</strong>
				</p>
			) : null}
			<ul className="divide-y rounded-md border">
				{(projects.data?.rows ?? [])
					.filter((row) => row.id !== excludeId)
					.map((row) => (
						<li key={row.id}>
							<button
								type="button"
								className={`w-full px-3 py-1.5 text-left text-sm hover:bg-accent ${value === row.id ? "bg-accent" : ""}`}
								onClick={() => onPick(row.id, row.name)}
							>
								<span className="font-medium">{row.name}</span>
								<span className="ml-2 text-muted-foreground text-xs">
									{[row.city, row.stateCode].filter(Boolean).join(", ")}
								</span>
							</button>
						</li>
					))}
			</ul>
		</div>
	);
}
