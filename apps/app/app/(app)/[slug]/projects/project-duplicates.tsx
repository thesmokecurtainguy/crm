"use client";

import type { LeadStatus, ProjectStage } from "@crm/db/enums";
import { Button } from "@crm/ui/components/button";
import { Spinner } from "@crm/ui/components/spinner";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { LocalDay } from "@/components/local-date-time";
import {
	formatProjectValue,
	leadStatusLabel,
	leadStatusTone,
	projectStageLabel,
	projectStageTone,
} from "@/lib/project-stage";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type Pair = RouterOutputs["projects"]["duplicates"][number];
type Side = Pair["a"];

function Card({ side, label }: { side: Side; label: string }) {
	const workspaceUrl = useWorkspaceUrl();
	return (
		<div className="min-w-0 flex-1 space-y-1 rounded-md border p-3 text-sm">
			<div className="text-muted-foreground text-xs uppercase">{label}</div>
			<Link
				href={workspaceUrl(`/projects/${side.id}`)}
				className="font-medium hover:underline"
			>
				{side.name}
			</Link>
			<div className="text-muted-foreground">
				{[side.address, side.city, side.stateCode].filter(Boolean).join(", ") ||
					"No address"}
			</div>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<StatusIndicator
					tone={projectStageTone(side.stage as ProjectStage)}
					label={projectStageLabel(side.stage as ProjectStage)}
				/>
				<StatusIndicator
					tone={leadStatusTone(side.leadStatus as LeadStatus)}
					label={leadStatusLabel(side.leadStatus as LeadStatus)}
				/>
				{formatProjectValue(side.value) ? (
					<span className="tabular-nums">{formatProjectValue(side.value)}</span>
				) : null}
			</div>
			<div className="text-muted-foreground text-xs">
				{side.architect ? `${side.architect} · ` : ""}
				{side.externalId && !side.externalId.startsWith("name:")
					? `CC #${side.externalId}`
					: "No ConstructConnect ID"}
				{side.lastUpdateAt ? (
					<>
						{" "}
						· updated <LocalDay date={side.lastUpdateAt} />
					</>
				) : null}
			</div>
		</div>
	);
}

export function ProjectDuplicates() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const duplicates = useQuery(trpc.projects.duplicates.queryOptions());
	const [dismissed, setDismissed] = useState<Set<string>>(new Set());

	const merge = useMutation(
		trpc.projects.merge.mutationOptions({
			onSuccess: async () => {
				toast.success("Merged.");
				await queryClient.invalidateQueries();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!duplicates.data) return <Spinner />;
	const pairs = duplicates.data.filter(
		(p) => !dismissed.has(`${p.a.id}|${p.b.id}`),
	);

	if (pairs.length === 0) {
		return (
			<p className="p-4 text-muted-foreground text-sm">
				No likely duplicates. Pairs show up here when two projects share a name
				and state, an address, or a name-keyed import sits next to its
				ConstructConnect record.
			</p>
		);
	}

	return (
		<ul className="space-y-4 p-1">
			{pairs.map((pair) => {
				const key = `${pair.a.id}|${pair.b.id}`;
				return (
					<li key={key} className="space-y-2 rounded-md border p-3">
						<div className="text-muted-foreground text-xs uppercase">
							{pair.reason}
						</div>
						<div className="flex flex-col gap-3 md:flex-row">
							<Card side={pair.a} label="A" />
							<Card side={pair.b} label="B" />
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Button
								size="sm"
								variant="outline"
								disabled={merge.isPending}
								onClick={() =>
									merge.mutate({ keepId: pair.a.id, mergeId: pair.b.id })
								}
							>
								Keep A, fold in B
							</Button>
							<Button
								size="sm"
								variant="outline"
								disabled={merge.isPending}
								onClick={() =>
									merge.mutate({ keepId: pair.b.id, mergeId: pair.a.id })
								}
							>
								Keep B, fold in A
							</Button>
							<Button
								size="sm"
								variant="ghost"
								onClick={() =>
									setDismissed((prev) => {
										const next = new Set(prev);
										next.add(key);
										return next;
									})
								}
							>
								Not a duplicate
							</Button>
						</div>
					</li>
				);
			})}
		</ul>
	);
}
