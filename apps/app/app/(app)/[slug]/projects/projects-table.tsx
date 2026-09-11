"use client";

import Archive from "@carbon/icons-react/es/Archive";
import Launch from "@carbon/icons-react/es/Launch";
import type { LeadStatus, ProjectStage } from "@crm/db/enums";
import { Button } from "@crm/ui/components/button";
import {
	DataTable,
	type DataTableColumn,
	type DataTableFacet,
} from "@crm/ui/components/data-table";
import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { useTableSelection } from "@crm/ui/hooks/use-table-selection";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CompanyCell } from "@/components/crm/company-cell";
import { ContactSearch } from "@/components/crm/contact-search";
import { OwnerCell } from "@/components/crm/owner-cell";
import { ListSearch } from "@/components/data-table/list-search";
import { useTableQuery } from "@/components/data-table/use-table-query";
import { LocalDay, LocalRelativeTime } from "@/components/local-date-time";
import {
	constructConnectUrl,
	formatProjectValue,
	LEAD_STATUS_OPTIONS,
	leadStatusLabel,
	leadStatusTone,
	PROJECT_STAGE_OPTIONS,
	projectStageLabel,
	projectStageTone,
} from "@/lib/project-stage";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { projectsSearchParams } from "./projects-search-params";

type ProjectRow = RouterOutputs["projects"]["list"]["rows"][number];

const COLUMNS: DataTableColumn<ProjectRow>[] = [
	{
		id: "name",
		header: "Project",
		sortable: true,
		hideable: false,
		width: "w-[26%]",
		cell: (row) => (
			<span className="flex min-w-0 flex-col">
				<span className="flex min-w-0 items-center gap-1.5">
					<span className="truncate font-medium">{row.name}</span>
					{constructConnectUrl(row.externalId) ? (
						<a
							href={constructConnectUrl(row.externalId) ?? "#"}
							target="_blank"
							rel="noreferrer"
							aria-label="Open in ConstructConnect"
							className="shrink-0 text-muted-foreground hover:text-foreground"
							onClick={(event) => event.stopPropagation()}
						>
							<Launch className="size-3.5" />
						</a>
					) : null}
				</span>
				{row.category ? (
					<span className="truncate text-muted-foreground text-xs">
						{row.category}
					</span>
				) : null}
			</span>
		),
	},
	{
		id: "stateCode",
		header: "Location",
		sortable: true,
		width: "w-[12%]",
		cell: (row) =>
			row.city || row.stateCode ? (
				<span className="truncate text-muted-foreground">
					{[row.city, row.stateCode].filter(Boolean).join(", ")}
				</span>
			) : (
				<EmptyCellValue />
			),
	},
	{
		id: "stage",
		header: "Stage",
		sortable: true,
		width: "w-[14%]",
		cell: (row) => (
			<StatusIndicator
				tone={projectStageTone(row.stage as ProjectStage)}
				label={projectStageLabel(row.stage as ProjectStage)}
			/>
		),
	},
	{
		id: "leadStatus",
		header: "Triage",
		width: "w-[10%]",
		hideBelow: "md",
		cell: (row) => (
			<StatusIndicator
				tone={leadStatusTone(row.leadStatus as LeadStatus)}
				label={leadStatusLabel(row.leadStatus as LeadStatus)}
			/>
		),
	},
	{
		id: "architect",
		header: "Architect",
		width: "w-[16%]",
		cell: (row) => <CompanyCell company={row.architect} />,
	},
	{
		id: "value",
		header: "Value",
		sortable: true,
		align: "right",
		width: "w-[9%]",
		hideBelow: "sm",
		cell: (row) => {
			const value = formatProjectValue(row.value);
			return value ? (
				<span className="tabular-nums">{value}</span>
			) : (
				<EmptyCellValue />
			);
		},
	},
	{
		id: "floors",
		header: "Floors",
		sortable: true,
		align: "right",
		width: "w-[6%]",
		hideBelow: "lg",
		cell: (row) =>
			row.floors === null ? (
				<EmptyCellValue />
			) : (
				<span className="tabular-nums">{row.floors}</span>
			),
	},
	{
		id: "bidDate",
		header: "Bid date",
		sortable: true,
		width: "w-[10%]",
		hideBelow: "lg",
		cell: (row) =>
			row.bidDate ? (
				<span className="text-muted-foreground">
					<LocalDay date={row.bidDate} />
				</span>
			) : (
				<EmptyCellValue />
			),
	},
	{
		id: "owner",
		header: "Owner",
		width: "w-[10%]",
		defaultHidden: true,
		cell: (row) => <OwnerCell owner={row.owner} />,
	},
	{
		id: "lastUpdateAt",
		header: "Last update",
		sortable: true,
		align: "right",
		width: "w-[12%]",
		hideBelow: "lg",
		cell: (row) => (
			<span className="flex min-w-0 flex-col items-end text-muted-foreground">
				{row.lastUpdateAt ? (
					<LocalRelativeTime date={row.lastUpdateAt} />
				) : (
					<EmptyCellValue />
				)}
				{row.lastUpdateReason ? (
					<span className="max-w-full truncate text-xs">
						{row.lastUpdateReason}
					</span>
				) : null}
			</span>
		),
	},
];

const ASSIGN_ROLES = [
	"Project architect",
	"Principal",
	"Project manager",
	"Spec writer",
	"Estimator",
	"Owner's rep",
	"Other",
];

const ARCHIVED_COLUMN: DataTableColumn<ProjectRow> = {
	id: "archivedAt",
	header: "Archived",
	sortable: false,
	align: "right",
	width: "w-[12%]",
	cell: (row) => (
		<span className="text-muted-foreground">
			{row.archivedAt ? (
				<LocalRelativeTime date={row.archivedAt} />
			) : (
				<EmptyCellValue />
			)}
		</span>
	),
};

export function ProjectsTable() {
	const trpc = useTRPC();
	const router = useRouter();
	const workspaceUrl = useWorkspaceUrl();
	const { query, input, setArchived } = useTableQuery(projectsSearchParams);

	const projects = useQuery({
		...trpc.projects.list.queryOptions(input),
		placeholderData: (previous) => previous,
	});
	const users = useQuery(trpc.users.list.queryOptions());

	const rows = projects.data?.rows ?? [];
	const selection = useTableSelection(
		useMemo(() => rows.map((row) => row.id), [rows]),
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: clearing on archived-mode change is the entire purpose of this effect.
	useEffect(() => {
		selection.clear();
	}, [input.archived]);

	const bulkArchive = useMutation(
		trpc.projects.bulkArchive.mutationOptions({
			onSuccess: async (result) => {
				await projects.refetch();
				selection.clear();
				toast.success(`Archived ${result.succeeded} projects.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const [qualifyStage, setQualifyStage] =
		useState<ProjectStage>("SCHEMATIC_DESIGN");
	const [watchUntil, setWatchUntil] = useState("");

	const bulkTriage = useMutation(
		trpc.projects.bulkTriage.mutationOptions({
			onSuccess: async (result, variables) => {
				await projects.refetch();
				selection.clear();
				toast.success(
					variables.leadStatus === "QUALIFIED"
						? `Moved ${result.succeeded} projects into the pipeline.`
						: variables.leadStatus === "WATCH"
							? `Watching ${result.succeeded} projects.`
							: `${result.succeeded} projects back to leads.`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const me = useQuery(trpc.users.me.queryOptions());
	const [assignRole, setAssignRole] = useState("Project architect");

	const bulkOwner = useMutation(
		trpc.projects.bulkSetOwner.mutationOptions({
			onSuccess: async (result) => {
				await projects.refetch();
				selection.clear();
				toast.success(`Owner set on ${result.succeeded} projects.`);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const bulkAssign = useMutation(
		trpc.projects.bulkAddParticipant.mutationOptions({
			onSuccess: async (result) => {
				await projects.refetch();
				selection.clear();
				toast.success(
					`Assigned on ${result.succeeded} projects${
						result.skipped ? ` (${result.skipped} already had them)` : ""
					}.`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const bulkBusy =
		bulkArchive.isPending ||
		bulkTriage.isPending ||
		bulkOwner.isPending ||
		bulkAssign.isPending;

	const facetCounts = projects.data?.facetCounts;

	const facets: DataTableFacet[] = [
		{
			id: "stage",
			label: "Stage",
			options: PROJECT_STAGE_OPTIONS.filter(
				(option) => (facetCounts?.stage?.[option.value] ?? 0) > 0,
			),
		},
		{
			id: "leadStatus",
			label: "Triage",
			options: LEAD_STATUS_OPTIONS.filter(
				(option) => (facetCounts?.leadStatus?.[option.value] ?? 0) > 0,
			),
		},
		{
			id: "stateCode",
			label: "State",
			options: Object.keys(facetCounts?.stateCode ?? {})
				.sort()
				.map((value) => ({ value, label: value })),
		},
		{
			id: "owner",
			label: "Owner",
			options: (users.data ?? []).map((user) => ({
				value: user.id,
				label: user.name,
			})),
		},
	];

	const columns = useMemo(
		() => (input.archived ? [...COLUMNS, ARCHIVED_COLUMN] : COLUMNS),
		[input.archived],
	);

	return (
		<DataTable
			query={query}
			search={<ListSearch placeholder="Search projects, cities, architects…" />}
			actions={
				<Button
					variant={input.archived ? "contrast" : "outline"}
					size="sm"
					className="justify-start sm:justify-center"
					onClick={() => {
						selection.clear();
						setArchived(!input.archived);
					}}
				>
					<Archive data-icon="inline-start" />
					Archived
				</Button>
			}
			columns={columns}
			rows={rows}
			total={projects.data?.total ?? 0}
			facetCounts={facetCounts}
			facets={facets}
			tabs={{
				id: "status",
				allLabel: "All projects",
				options: [
					{ value: "leads", label: "Leads" },
					{ value: "pipeline", label: "Pipeline" },
					{ value: "closed", label: "Closed" },
				],
			}}
			selection={{
				state: selection,
				actions: (
					<div className="flex flex-wrap items-center gap-2">
						<Select
							value={qualifyStage}
							onValueChange={(value) => setQualifyStage(value as ProjectStage)}
						>
							<SelectTrigger size="sm" className="w-[190px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PROJECT_STAGE_OPTIONS.filter(
									(o) => o.value !== "WON" && o.value !== "LOST",
								).map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Button
							size="sm"
							disabled={bulkBusy || selection.ids.length === 0}
							onClick={() =>
								bulkTriage.mutate({
									ids: selection.ids,
									leadStatus: "QUALIFIED",
									stage: qualifyStage,
								})
							}
						>
							Qualify
						</Button>
						<Input
							type="date"
							value={watchUntil}
							onChange={(event) => setWatchUntil(event.target.value)}
							className="h-8 w-[150px]"
						/>
						<Button
							size="sm"
							variant="outline"
							disabled={bulkBusy || selection.ids.length === 0}
							onClick={() =>
								bulkTriage.mutate({
									ids: selection.ids,
									leadStatus: "WATCH",
									watchUntil: watchUntil
										? new Date(`${watchUntil}T12:00:00`).toISOString()
										: null,
								})
							}
						>
							Watch
						</Button>
						<Button
							size="sm"
							variant="ghost"
							disabled={bulkBusy || selection.ids.length === 0}
							onClick={() =>
								bulkTriage.mutate({ ids: selection.ids, leadStatus: "LEAD" })
							}
						>
							Back to lead
						</Button>
						<Button
							size="sm"
							variant="outline"
							disabled={bulkBusy || selection.ids.length === 0 || !me.data?.id}
							onClick={() =>
								bulkOwner.mutate({
									ids: selection.ids,
									ownerId: me.data?.id ?? null,
								})
							}
						>
							Make me owner
						</Button>
						<Select value={assignRole} onValueChange={setAssignRole}>
							<SelectTrigger size="sm" className="w-[160px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{ASSIGN_ROLES.map((role) => (
									<SelectItem key={role} value={role}>
										{role}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<ContactSearch
							label="Assign person"
							onPick={(contact) =>
								bulkAssign.mutate({
									ids: selection.ids,
									contactId: contact.id,
									role: assignRole,
								})
							}
						/>
						<Button
							size="sm"
							variant="outline"
							disabled={bulkBusy || selection.ids.length === 0}
							onClick={() => bulkArchive.mutate({ ids: selection.ids })}
						>
							<Archive data-icon="inline-start" />
							Archive
						</Button>
					</div>
				),
				rowLabel: (row) => row.name,
			}}
			getRowId={(row) => row.id}
			loading={projects.isFetching}
			onRowClick={(row) => router.push(workspaceUrl(`/projects/${row.id}`))}
			empty={
				input.archived
					? "No archived projects."
					: "No projects match this view. Import a ConstructConnect list from Settings → Import."
			}
			meta={<span>{projects.data?.total ?? 0} projects</span>}
		/>
	);
}
