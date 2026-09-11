"use client";

import type { LeadStatus, ProjectStage } from "@crm/db/enums";
import { Button } from "@crm/ui/components/button";
import { Spinner } from "@crm/ui/components/spinner";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { type DragEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { LocalDay } from "@/components/local-date-time";
import {
	formatProjectValue,
	leadStatusLabel,
	leadStatusTone,
	projectStageLabel,
} from "@/lib/project-stage";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type Row = RouterOutputs["projects"]["list"]["rows"][number];

const BOARD_STAGES: ProjectStage[] = [
	"PRE_DESIGN",
	"SCHEMATIC_DESIGN",
	"DESIGN_DEVELOPMENT",
	"CONSTRUCTION_DOCUMENTS",
	"BIDDING",
	"UNDER_CONSTRUCTION",
	"WON",
	"LOST",
];

function money(total: number): string {
	if (total === 0) return "";
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(total);
}

export function ProjectsBoard() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();
	const [dragging, setDragging] = useState<string | null>(null);
	const [over, setOver] = useState<ProjectStage | null>(null);

	const projects = useQuery({
		...trpc.projects.list.queryOptions({
			status: "pipeline",
			pageSize: 200,
			page: 1,
		}),
		placeholderData: (previous) => previous,
	});

	const update = useMutation(
		trpc.projects.update.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.projects.list.queryKey(),
				});
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const byStage = useMemo(() => {
		const map = new Map<ProjectStage, Row[]>();
		for (const stage of BOARD_STAGES) map.set(stage, []);
		for (const row of projects.data?.rows ?? []) {
			const list = map.get(row.stage as ProjectStage);
			if (list) list.push(row);
		}
		return map;
	}, [projects.data]);

	if (!projects.data) return <Spinner />;

	const drop = (stage: ProjectStage) => (event: DragEvent) => {
		event.preventDefault();
		setOver(null);
		const id = dragging ?? event.dataTransfer.getData("text/plain");
		setDragging(null);
		if (!id) return;
		const row = (projects.data?.rows ?? []).find((r) => r.id === id);
		if (!row || row.stage === stage) return;
		update.mutate({ id, data: { stage } });
		toast.success(`Moved to ${projectStageLabel(stage)}.`);
	};

	return (
		<div className="flex min-h-0 gap-3 overflow-x-auto p-1">
			{BOARD_STAGES.map((stage) => {
				const rows = byStage.get(stage) ?? [];
				const total = rows.reduce((sum, row) => sum + (row.value ?? 0), 0);
				return (
					// biome-ignore lint/a11y/noStaticElementInteractions: a drop target is a pointer affordance; stage is also changeable from the project page and the list's bulk actions.
					<section
						key={stage}
						className={`flex w-[260px] shrink-0 flex-col rounded-md border ${
							over === stage ? "border-primary bg-primary/5" : ""
						}`}
						onDragOver={(event) => {
							event.preventDefault();
							setOver(stage);
						}}
						onDragLeave={() =>
							setOver((current) => (current === stage ? null : current))
						}
						onDrop={drop(stage)}
					>
						<header className="flex items-baseline justify-between gap-2 border-b px-3 py-2">
							<span className="truncate font-medium text-sm">
								{projectStageLabel(stage)}
							</span>
							<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
								{rows.length}
								{total ? ` · ${money(total)}` : ""}
							</span>
						</header>
						<ul className="flex flex-col gap-2 overflow-y-auto p-2">
							{rows.length === 0 ? (
								<li className="px-1 py-3 text-muted-foreground text-xs">
									Drag a project here.
								</li>
							) : null}
							{rows.map((row) => (
								<li key={row.id}>
									{
										// biome-ignore lint/a11y/noStaticElementInteractions: drag handle; the card's link and the project page cover keyboard users.
										<div
											draggable
											onDragStart={(event) => {
												setDragging(row.id);
												event.dataTransfer.setData("text/plain", row.id);
												event.dataTransfer.effectAllowed = "move";
											}}
											onDragEnd={() => setDragging(null)}
											className={`cursor-grab space-y-1 rounded border bg-card p-2 text-sm active:cursor-grabbing ${
												dragging === row.id ? "opacity-50" : ""
											}`}
										>
											<Link
												href={workspaceUrl(`/projects/${row.id}`)}
												className="line-clamp-2 font-medium hover:underline"
											>
												{row.name}
											</Link>
											<div className="text-muted-foreground text-xs">
												{[row.city, row.stateCode].filter(Boolean).join(", ")}
												{row.architect ? ` · ${row.architect.name}` : ""}
											</div>
											<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
												{formatProjectValue(row.value) ? (
													<span className="tabular-nums">
														{formatProjectValue(row.value)}
													</span>
												) : null}
												{row.floors ? (
													<span className="text-muted-foreground">
														{row.floors} fl
													</span>
												) : null}
												{row.bidDate ? (
													<span className="text-muted-foreground">
														Bid <LocalDay date={row.bidDate} />
													</span>
												) : null}
											</div>
											<StatusIndicator
												tone={leadStatusTone(row.leadStatus as LeadStatus)}
												label={leadStatusLabel(row.leadStatus as LeadStatus)}
											/>
										</div>
									}
								</li>
							))}
						</ul>
					</section>
				);
			})}
		</div>
	);
}

export function BoardToggle({
	board,
	onToggle,
}: {
	board: boolean;
	onToggle: () => void;
}) {
	return (
		<Button
			variant={board ? "contrast" : "outline"}
			size="sm"
			className="justify-start sm:justify-center"
			onClick={onToggle}
		>
			{board ? "List" : "Board"}
		</Button>
	);
}
