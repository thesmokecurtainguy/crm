"use client";

import Archive from "@carbon/icons-react/es/Archive";
import ArrowLeft from "@carbon/icons-react/es/ArrowLeft";
import ChevronDown from "@carbon/icons-react/es/ChevronDown";
import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import Close from "@carbon/icons-react/es/Close";
import Launch from "@carbon/icons-react/es/Launch";
import Undo from "@carbon/icons-react/es/Undo";
import type { DealStage, LeadStatus, ProjectStage } from "@crm/db/enums";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import { StatusIndicator } from "@crm/ui/components/status-indicator";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import { CompanyPicker } from "@/components/crm/company-picker";
import {
	type ComposeContext,
	ComposeDialog,
} from "@/components/crm/compose-dialog";
import { ContactSearch } from "@/components/crm/contact-search";
import { Timeline } from "@/components/crm/timeline/timeline";
import { LocalDay } from "@/components/local-date-time";
import { dealStageLabel } from "@/lib/deal-stage";
import {
	COMPETITOR_CONFIDENCE_OPTIONS,
	constructConnectUrl,
	formatProjectValue,
	LOST_REASON_OPTIONS,
	leadStatusLabel,
	leadStatusTone,
	PROJECT_STAGE_OPTIONS,
	projectStageLabel,
	projectStageTone,
} from "@/lib/project-stage";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

type Project = RouterOutputs["projects"]["byId"];

const NONE = "__none__";

const ROLE_LABEL = {
	architect: "Architect",
	gc: "General contractor",
	developer: "Developer / owner",
} as const;

const PERSON_ROLES = [
	"Project architect",
	"Principal",
	"Project manager",
	"Spec writer",
	"Designer",
	"Estimator",
	"Owner's rep",
	"Other",
];

const FIRM_ROLES = [
	"Architect",
	"Architect of record",
	"General contractor",
	"Construction manager",
	"Developer",
	"Owner",
	"Engineer",
	"Consultant",
	"Distributor",
];

const COLLAPSE_KEY = "crm.project.collapsed";

function readCollapsed(): Set<string> {
	if (typeof window === "undefined") return new Set();
	try {
		const raw = window.sessionStorage.getItem(COLLAPSE_KEY);
		return new Set(raw ? (JSON.parse(raw) as string[]) : []);
	} catch {
		return new Set();
	}
}

function Section({
	id,
	title,
	action,
	collapsed,
	onToggle,
	children,
}: {
	id: string;
	title: string;
	action?: ReactNode;
	collapsed: Set<string>;
	onToggle: (id: string) => void;
	children: ReactNode;
}) {
	const open = !collapsed.has(id);
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between gap-2">
				<button
					type="button"
					className="flex items-center gap-1 text-left"
					onClick={() => onToggle(id)}
					aria-expanded={open}
				>
					{open ? (
						<ChevronDown className="size-4" />
					) : (
						<ChevronRight className="size-4" />
					)}
					<CardTitle>{title}</CardTitle>
				</button>
				{open ? action : null}
			</CardHeader>
			{open ? (
				<CardContent className="space-y-4">{children}</CardContent>
			) : null}
		</Card>
	);
}

type Draft = {
	name: string;
	externalId: string;
	address: string;
	city: string;
	stateCode: string;
	county: string;
	category: string;
	stage: ProjectStage;
	value: string;
	floors: string;
	units: string;
	floorArea: string;
	startDate: string;
	bidDate: string;
	architectId: string;
	gcId: string;
	developerId: string;
	ownerId: string;
	description: string;
	lastUpdateReason: string;
	competitor: string;
	competitorPricing: string;
	competitorConfidence: string;
	lostReason: string;
};

function dayInput(value: string | null): string {
	return value ? value.slice(0, 10) : "";
}

function toDraft(project: Project): Draft {
	return {
		name: project.name,
		externalId: project.externalId ?? "",
		address: project.address ?? "",
		city: project.city ?? "",
		stateCode: project.stateCode ?? "",
		county: project.county ?? "",
		category: project.category ?? "",
		stage: project.stage as ProjectStage,
		value: project.value === null ? "" : String(project.value),
		floors: project.floors === null ? "" : String(project.floors),
		units: project.units === null ? "" : String(project.units),
		floorArea: project.floorArea === null ? "" : String(project.floorArea),
		startDate: dayInput(project.startDate),
		bidDate: dayInput(project.bidDate),
		architectId: project.architect?.id ?? "",
		gcId: project.gc?.id ?? "",
		developerId: project.developer?.id ?? "",
		ownerId: project.owner?.id ?? "",
		description: project.description ?? "",
		lastUpdateReason: project.lastUpdateReason ?? "",
		competitor: project.competitor ?? "",
		competitorPricing: project.competitorPricing ?? "",
		competitorConfidence: project.competitorConfidence ?? "",
		lostReason: project.lostReason ?? "",
	};
}

function numberOrNull(value: string): number | null {
	const trimmed = value.trim().replace(/[$,]/g, "");
	if (!trimmed) return null;
	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : null;
}

function intOrNull(value: string): number | null {
	const parsed = numberOrNull(value);
	return parsed === null ? null : Math.round(parsed);
}

function textOrNull(value: string): string | null {
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function dateOrNull(value: string): string | null {
	return value ? new Date(`${value}T12:00:00`).toISOString() : null;
}

export function ProjectDetail({ id }: { id: string }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const workspaceUrl = useWorkspaceUrl();

	const project = useQuery(trpc.projects.byId.queryOptions({ id }));
	const people = useQuery(trpc.projects.people.queryOptions({ id }));
	const participants = useQuery(
		trpc.projects.participants.queryOptions({ id }),
	);
	const users = useQuery(trpc.users.list.queryOptions());

	const [draft, setDraft] = useState<Draft | null>(null);
	const [watchUntil, setWatchUntil] = useState("");
	const [collapsed, setCollapsed] = useState<Set<string>>(() =>
		readCollapsed(),
	);
	const toggleSection = (sectionId: string) =>
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (next.has(sectionId)) next.delete(sectionId);
			else next.add(sectionId);
			try {
				window.sessionStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next]));
			} catch {}
			return next;
		});
	const [rosterOpen, setRosterOpen] = useState<Set<string>>(new Set());
	const [compose, setCompose] = useState<ComposeContext | null>(null);
	const [personRole, setPersonRole] = useState("Project architect");
	const [firmRole, setFirmRole] = useState("Architect");
	const [firmId, setFirmId] = useState("");
	const [quoteOpen, setQuoteOpen] = useState(false);
	const [quoteChannel, setQuoteChannel] = useState<"DISTRIBUTOR" | "DIRECT">(
		"DISTRIBUTOR",
	);
	const [quoteCompanyId, setQuoteCompanyId] = useState("");
	const [quoteAmount, setQuoteAmount] = useState("");
	const [quoteBidDate, setQuoteBidDate] = useState("");

	useEffect(() => {
		if (project.data) setDraft(toDraft(project.data));
	}, [project.data]);

	const refresh = async () => {
		await queryClient.invalidateQueries({
			queryKey: trpc.projects.byId.queryKey({ id }),
		});
		await queryClient.invalidateQueries({
			queryKey: trpc.projects.list.queryKey(),
		});
	};

	const update = useMutation(
		trpc.projects.update.mutationOptions({
			onSuccess: async () => {
				await refresh();
				toast.success("Project saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const triage = useMutation(
		trpc.projects.triage.mutationOptions({
			onSuccess: async (result) => {
				await refresh();
				toast.success(
					`Now ${leadStatusLabel(result.leadStatus as LeadStatus)}.`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const refreshParticipants = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.projects.participants.queryKey({ id }),
		});

	const addParticipant = useMutation(
		trpc.projects.addParticipant.mutationOptions({
			onSuccess: async () => {
				await refreshParticipants();
				setFirmId("");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const removeParticipant = useMutation(
		trpc.projects.removeParticipant.mutationOptions({
			onSuccess: () => refreshParticipants(),
			onError: (error) => toast.error(error.message),
		}),
	);

	const createQuote = useMutation(
		trpc.deals.create.mutationOptions({
			onSuccess: async () => {
				await refresh();
				setQuoteOpen(false);
				setQuoteAmount("");
				setQuoteBidDate("");
				toast.success(
					"Quote added. Its follow-up clock starts on the bid date.",
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const archive = useMutation(
		trpc.projects.archive.mutationOptions({
			onSuccess: async () => {
				await refresh();
				toast.success("Project archived. It stays searchable.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const restore = useMutation(
		trpc.projects.restore.mutationOptions({
			onSuccess: async () => {
				await refresh();
				toast.success("Project restored.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (!project.data || !draft) return <Spinner />;

	const current = project.data;
	const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
		setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));

	const save = () => {
		update.mutate({
			id,
			data: {
				name: draft.name.trim(),
				externalId: textOrNull(draft.externalId),
				address: textOrNull(draft.address),
				city: textOrNull(draft.city),
				stateCode: textOrNull(draft.stateCode),
				county: textOrNull(draft.county),
				category: textOrNull(draft.category),
				stage: draft.stage,
				value: numberOrNull(draft.value),
				floors: intOrNull(draft.floors),
				units: intOrNull(draft.units),
				floorArea: intOrNull(draft.floorArea),
				startDate: dateOrNull(draft.startDate),
				bidDate: dateOrNull(draft.bidDate),
				architectId: draft.architectId || null,
				gcId: draft.gcId || null,
				developerId: draft.developerId || null,
				ownerId: draft.ownerId || null,
				description: textOrNull(draft.description),
				lastUpdateReason: textOrNull(draft.lastUpdateReason),
				competitor: textOrNull(draft.competitor),
				competitorPricing: textOrNull(draft.competitorPricing),
				competitorConfidence:
					(draft.competitorConfidence as Project["competitorConfidence"]) ||
					null,
				lostReason: (draft.lostReason as Project["lostReason"]) || null,
			},
		});
	};

	const busy = update.isPending || triage.isPending;

	return (
		<div className="flex min-h-0 flex-col gap-6 overflow-y-auto p-4 md:p-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0 space-y-2">
					<Button asChild variant="ghost" size="sm" className="-ml-2">
						<Link href={workspaceUrl("/projects")}>
							<ArrowLeft data-icon="inline-start" />
							Projects
						</Link>
					</Button>
					<h1 className="truncate font-semibold text-2xl">{current.name}</h1>
					<div className="flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
						<StatusIndicator
							tone={projectStageTone(current.stage as ProjectStage)}
							label={projectStageLabel(current.stage as ProjectStage)}
						/>
						<StatusIndicator
							tone={leadStatusTone(current.leadStatus as LeadStatus)}
							label={leadStatusLabel(current.leadStatus as LeadStatus)}
						/>
						{current.watchUntil ? (
							<span>
								Re-check <LocalDay date={current.watchUntil} />
							</span>
						) : null}
						{formatProjectValue(current.value) ? (
							<span className="tabular-nums">
								{formatProjectValue(current.value)}
							</span>
						) : null}
						{constructConnectUrl(current.externalId) ? (
							<Button asChild variant="outline" size="sm">
								<a
									href={constructConnectUrl(current.externalId) ?? "#"}
									target="_blank"
									rel="noreferrer"
								>
									Open in ConstructConnect
									<Launch data-icon="inline-end" />
								</a>
							</Button>
						) : current.externalId ? (
							<span>ConstructConnect #{current.externalId}</span>
						) : null}
						{current.archivedAt ? <span>Archived</span> : null}
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{current.archivedAt ? (
						<Button
							variant="outline"
							size="sm"
							disabled={restore.isPending}
							onClick={() => restore.mutate({ id })}
						>
							<Undo data-icon="inline-start" />
							Restore
						</Button>
					) : (
						<Button
							variant="outline"
							size="sm"
							disabled={archive.isPending}
							onClick={() => archive.mutate({ id })}
						>
							<Archive data-icon="inline-start" />
							Archive
						</Button>
					)}
					<Button
						size="sm"
						onClick={save}
						disabled={busy || !draft.name.trim()}
					>
						{update.isPending ? <Spinner data-icon="inline-start" /> : null}
						Save
					</Button>
				</div>
			</div>

			<Section
				id="triage"
				title="Triage"
				collapsed={collapsed}
				onToggle={toggleSection}
			>
				<div className="flex flex-wrap items-end gap-3">
					<Field className="w-40">
						<FieldLabel>Qualify into</FieldLabel>
						<Select
							value={draft.stage}
							onValueChange={(value) => set("stage", value as ProjectStage)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PROJECT_STAGE_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Button
						size="sm"
						disabled={busy}
						onClick={() =>
							triage.mutate({ id, leadStatus: "QUALIFIED", stage: draft.stage })
						}
					>
						Qualify
					</Button>
					<Field className="w-40">
						<FieldLabel>Re-check on</FieldLabel>
						<Input
							type="date"
							value={watchUntil}
							onChange={(event) => setWatchUntil(event.target.value)}
						/>
					</Field>
					<Button
						size="sm"
						variant="outline"
						disabled={busy}
						onClick={() =>
							triage.mutate({
								id,
								leadStatus: "WATCH",
								watchUntil: dateOrNull(watchUntil),
							})
						}
					>
						Watch
					</Button>
					<Button
						size="sm"
						variant="ghost"
						disabled={busy || current.leadStatus === "LEAD"}
						onClick={() => triage.mutate({ id, leadStatus: "LEAD" })}
					>
						Back to lead
					</Button>
					<FieldDescription className="basis-full">
						Qualify moves the project into the pipeline at the chosen stage.
						Watch parks it and asks the agent to look again on the date. Archive
						(top right) hides it from every view but keeps it searchable.
					</FieldDescription>
				</div>
			</Section>

			<div className="grid gap-6 lg:grid-cols-2">
				<Section
					id="people"
					title="People on this project"
					collapsed={collapsed}
					onToggle={toggleSection}
					action={
						<div className="flex items-center gap-2">
							<Select value={personRole} onValueChange={setPersonRole}>
								<SelectTrigger size="sm" className="w-[160px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{PERSON_ROLES.map((role) => (
										<SelectItem key={role} value={role}>
											{role}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<ContactSearch
								onPick={(contact) =>
									addParticipant.mutate({
										projectId: id,
										contactId: contact.id,
										role: personRole,
									})
								}
							/>
						</div>
					}
				>
					{(participants.data ?? []).filter((p) => p.contact).length === 0 ? (
						<p className="text-muted-foreground text-sm">
							Nobody assigned yet. Pick a role and add the project architect,
							PM, or whoever you actually talk to. The full firm rosters are
							below.
						</p>
					) : (
						<ul className="divide-y text-sm">
							{(participants.data ?? [])
								.filter((p) => p.contact)
								.map((p) => (
									<li
										key={p.id}
										className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5"
									>
										<Link
											href={`${workspaceUrl("/contacts")}?record=contact:${p.contact?.id}`}
											className="font-medium hover:underline"
										>
											{p.contact?.name}
										</Link>
										<span className="text-muted-foreground text-xs uppercase">
											{p.role}
										</span>
										{p.contact?.company ? (
											<span className="text-muted-foreground">
												{p.contact.company.name}
											</span>
										) : null}
										<span className="ml-auto flex flex-wrap items-center gap-x-3 text-muted-foreground">
											{p.contact?.phone ? (
												<a
													href={`tel:${p.contact.phone}`}
													className="hover:underline"
												>
													{p.contact.phone}
												</a>
											) : null}
											{p.contact?.email ? (
												<a
													href={`mailto:${p.contact.email}`}
													className="hover:underline"
												>
													{p.contact.email}
												</a>
											) : null}
											<Button
												variant="ghost"
												size="icon-sm"
												aria-label="Remove from project"
												onClick={() => removeParticipant.mutate({ id: p.id })}
											>
												<Close />
											</Button>
										</span>
									</li>
								))}
						</ul>
					)}

					{(people.data ?? []).map((group) => {
						const open = rosterOpen.has(group.company.id);
						return (
							<div key={group.company.id} className="space-y-2 border-t pt-3">
								<div className="flex flex-wrap items-baseline justify-between gap-2">
									<div className="min-w-0">
										<span className="text-muted-foreground text-xs uppercase">
											{ROLE_LABEL[group.role]}
										</span>
										<div className="truncate font-medium">
											<Link
												href={`${workspaceUrl("/companies")}?record=company:${group.company.id}`}
												className="hover:underline"
											>
												{group.company.name}
											</Link>
											{group.company.city ? (
												<span className="ml-2 text-muted-foreground text-sm">
													{[group.company.city, group.company.stateCode]
														.filter(Boolean)
														.join(", ")}
												</span>
											) : null}
										</div>
									</div>
									<span className="flex items-center gap-3">
										{group.company.phone ? (
											<a
												href={`tel:${group.company.phone}`}
												className="text-sm tabular-nums hover:underline"
											>
												{group.company.phone}
											</a>
										) : null}
										{group.contacts.length > 0 ? (
											<button
												type="button"
												className="text-muted-foreground text-sm hover:underline"
												onClick={() =>
													setRosterOpen((prev) => {
														const next = new Set(prev);
														if (next.has(group.company.id))
															next.delete(group.company.id);
														else next.add(group.company.id);
														return next;
													})
												}
											>
												{open
													? "Hide roster"
													: `Show all ${group.contacts.length}`}
											</button>
										) : null}
									</span>
								</div>
								{open ? (
									<ul className="divide-y text-sm">
										{group.contacts.map((c) => (
											<li
												key={c.id}
												className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5"
											>
												<Link
													href={`${workspaceUrl("/contacts")}?record=contact:${c.id}`}
													className="font-medium hover:underline"
												>
													{c.name}
												</Link>
												{c.title ? (
													<span className="text-muted-foreground">
														{c.title}
													</span>
												) : null}
												<span className="ml-auto flex flex-wrap items-center gap-x-3 text-muted-foreground">
													{c.phone ? (
														<a
															href={`tel:${c.phone}`}
															className="hover:underline"
														>
															{c.phone}
														</a>
													) : null}
													{c.email ? (
														<a
															href={`mailto:${c.email}`}
															className="hover:underline"
														>
															{c.email}
														</a>
													) : null}
													<Button
														variant="ghost"
														size="sm"
														onClick={() =>
															addParticipant.mutate({
																projectId: id,
																contactId: c.id,
																role: personRole,
															})
														}
													>
														Assign
													</Button>
												</span>
											</li>
										))}
									</ul>
								) : null}
							</div>
						);
					})}
				</Section>

				<Section
					id="log"
					title="Log"
					collapsed={collapsed}
					onToggle={toggleSection}
				>
					<Timeline anchor={{ projectId: id }} />
				</Section>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<Section
					id="building"
					title="Building"
					collapsed={collapsed}
					onToggle={toggleSection}
				>
					<FieldGroup>
						<Field>
							<FieldLabel>Name</FieldLabel>
							<Input
								value={draft.name}
								onChange={(event) => set("name", event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel>Address</FieldLabel>
							<Input
								value={draft.address}
								onChange={(event) => set("address", event.target.value)}
							/>
						</Field>
						<div className="grid grid-cols-3 gap-3">
							<Field>
								<FieldLabel>City</FieldLabel>
								<Input
									value={draft.city}
									onChange={(event) => set("city", event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel>State</FieldLabel>
								<Input
									value={draft.stateCode}
									maxLength={2}
									onChange={(event) => set("stateCode", event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel>County</FieldLabel>
								<Input
									value={draft.county}
									onChange={(event) => set("county", event.target.value)}
								/>
							</Field>
						</div>
						<Field>
							<FieldLabel>Category</FieldLabel>
							<Input
								value={draft.category}
								placeholder="Apartments, Parking Garages, Retail Stores"
								onChange={(event) => set("category", event.target.value)}
							/>
						</Field>
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
							<Field>
								<FieldLabel>Value ($)</FieldLabel>
								<Input
									inputMode="decimal"
									value={draft.value}
									onChange={(event) => set("value", event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel>Floors</FieldLabel>
								<Input
									inputMode="numeric"
									value={draft.floors}
									onChange={(event) => set("floors", event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel>Units</FieldLabel>
								<Input
									inputMode="numeric"
									value={draft.units}
									onChange={(event) => set("units", event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel>Floor area (sf)</FieldLabel>
								<Input
									inputMode="numeric"
									value={draft.floorArea}
									onChange={(event) => set("floorArea", event.target.value)}
								/>
							</Field>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<Field>
								<FieldLabel>Start date</FieldLabel>
								<Input
									type="date"
									value={draft.startDate}
									onChange={(event) => set("startDate", event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel>Bid date</FieldLabel>
								<Input
									type="date"
									value={draft.bidDate}
									onChange={(event) => set("bidDate", event.target.value)}
								/>
								<FieldDescription>
									The distributor follow-up clock starts here.
								</FieldDescription>
							</Field>
						</div>
						<Field>
							<FieldLabel>ConstructConnect ID</FieldLabel>
							<Input
								value={draft.externalId}
								onChange={(event) => set("externalId", event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel>Scope</FieldLabel>
							<Textarea
								rows={5}
								value={draft.description}
								onChange={(event) => set("description", event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel>Last update reason</FieldLabel>
							<Input
								value={draft.lastUpdateReason}
								placeholder="Updated to Design Development stage"
								onChange={(event) =>
									set("lastUpdateReason", event.target.value)
								}
							/>
						</Field>
					</FieldGroup>
				</Section>

				<div className="flex flex-col gap-6">
					<Section
						id="team"
						title="Team"
						collapsed={collapsed}
						onToggle={toggleSection}
					>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="project-architect">Architect</FieldLabel>
								<CompanyPicker
									id="project-architect"
									value={draft.architectId}
									onValueChange={(value) =>
										set("architectId", value === NONE ? "" : value)
									}
									none={{ value: NONE, label: "No architect" }}
									selected={
										current.architect
											? {
													value: current.architect.id,
													label: current.architect.name,
												}
											: undefined
									}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="project-gc">General contractor</FieldLabel>
								<CompanyPicker
									id="project-gc"
									value={draft.gcId}
									onValueChange={(value) =>
										set("gcId", value === NONE ? "" : value)
									}
									none={{ value: NONE, label: "No GC yet" }}
									selected={
										current.gc
											? { value: current.gc.id, label: current.gc.name }
											: undefined
									}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="project-developer">
									Developer / owner
								</FieldLabel>
								<CompanyPicker
									id="project-developer"
									value={draft.developerId}
									onValueChange={(value) =>
										set("developerId", value === NONE ? "" : value)
									}
									none={{ value: NONE, label: "No developer" }}
									selected={
										current.developer
											? {
													value: current.developer.id,
													label: current.developer.name,
												}
											: undefined
									}
								/>
							</Field>
							<Field>
								<FieldLabel>Owner (you)</FieldLabel>
								<Select
									value={draft.ownerId || NONE}
									onValueChange={(value) =>
										set("ownerId", value === NONE ? "" : value)
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Unassigned" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={NONE}>Unassigned</SelectItem>
										{(users.data ?? []).map((user) => (
											<SelectItem key={user.id} value={user.id}>
												{user.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						</FieldGroup>

						<div className="space-y-2 border-t pt-3">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span className="text-muted-foreground text-xs uppercase">
									More firms on this project
								</span>
								<div className="flex items-center gap-2">
									<Select value={firmRole} onValueChange={setFirmRole}>
										<SelectTrigger size="sm" className="w-[170px]">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{FIRM_ROLES.map((role) => (
												<SelectItem key={role} value={role}>
													{role}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<CompanyPicker
										id="project-more-firm"
										value={firmId}
										onValueChange={setFirmId}
										placeholder="Add a firm"
										className="w-[200px]"
									/>
									<Button
										size="sm"
										disabled={!firmId || addParticipant.isPending}
										onClick={() =>
											addParticipant.mutate({
												projectId: id,
												companyId: firmId,
												role: firmRole,
											})
										}
									>
										Add
									</Button>
								</div>
							</div>
							{(participants.data ?? []).filter((p) => p.company).length ===
							0 ? (
								<p className="text-muted-foreground text-sm">
									A second architect, a CM alongside the GC, a co-developer —
									add them here with a role.
								</p>
							) : (
								<ul className="divide-y text-sm">
									{(participants.data ?? [])
										.filter((p) => p.company)
										.map((p) => (
											<li
												key={p.id}
												className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5"
											>
												<Link
													href={`${workspaceUrl("/companies")}?record=company:${p.company?.id}`}
													className="font-medium hover:underline"
												>
													{p.company?.name}
												</Link>
												<span className="text-muted-foreground text-xs uppercase">
													{p.role}
												</span>
												<span className="ml-auto flex items-center gap-3 text-muted-foreground">
													{p.company?.phone ? (
														<a
															href={`tel:${p.company.phone}`}
															className="hover:underline"
														>
															{p.company.phone}
														</a>
													) : null}
													<Button
														variant="ghost"
														size="icon-sm"
														aria-label="Remove from project"
														onClick={() =>
															removeParticipant.mutate({ id: p.id })
														}
													>
														<Close />
													</Button>
												</span>
											</li>
										))}
								</ul>
							)}
						</div>
					</Section>

					<Section
						id="competition"
						title="Competition"
						collapsed={collapsed}
						onToggle={toggleSection}
					>
						<FieldGroup>
							<Field>
								<FieldLabel>Competitor on the job</FieldLabel>
								<Input
									value={draft.competitor}
									placeholder="Smoke Guard, McKeon, none known"
									onChange={(event) => set("competitor", event.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel>What the estimator said</FieldLabel>
								<Textarea
									rows={3}
									value={draft.competitorPricing}
									placeholder="“You're looking good” · “about 5% spread” · a number"
									onChange={(event) =>
										set("competitorPricing", event.target.value)
									}
								/>
							</Field>
							<Field>
								<FieldLabel>How sure</FieldLabel>
								<Select
									value={draft.competitorConfidence || NONE}
									onValueChange={(value) =>
										set("competitorConfidence", value === NONE ? "" : value)
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Not rated" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={NONE}>Not rated</SelectItem>
										{COMPETITOR_CONFIDENCE_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							{draft.stage === "LOST" ? (
								<Field>
									<FieldLabel>Why we lost</FieldLabel>
									<Select
										value={draft.lostReason || NONE}
										onValueChange={(value) =>
											set("lostReason", value === NONE ? "" : value)
										}
									>
										<SelectTrigger>
											<SelectValue placeholder="Pick a reason" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NONE}>Not recorded</SelectItem>
											{LOST_REASON_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</Field>
							) : null}
						</FieldGroup>
					</Section>

					<Section
						id="quotes"
						title="Quotes"
						collapsed={collapsed}
						onToggle={toggleSection}
						action={
							<Button
								size="sm"
								variant={quoteOpen ? "ghost" : "outline"}
								onClick={() => setQuoteOpen((open) => !open)}
							>
								{quoteOpen ? "Cancel" : "New quote"}
							</Button>
						}
					>
						{quoteOpen ? (
							<FieldGroup>
								<Field>
									<FieldLabel>Who is bidding</FieldLabel>
									<div className="flex gap-2">
										<Button
											size="sm"
											variant={
												quoteChannel === "DISTRIBUTOR" ? "contrast" : "outline"
											}
											onClick={() => setQuoteChannel("DISTRIBUTOR")}
										>
											Through a distributor
										</Button>
										<Button
											size="sm"
											variant={
												quoteChannel === "DIRECT" ? "contrast" : "outline"
											}
											onClick={() => {
												setQuoteChannel("DIRECT");
												setQuoteCompanyId(current.gc?.id ?? "");
											}}
										>
											We bid direct
										</Button>
									</div>
									<FieldDescription>
										{quoteChannel === "DIRECT"
											? "No salesperson to chase. The follow-up clock points at you, and the buyer is the GC."
											: "The distributor's salesperson owns the follow-up. You can add several quotes on one project."}
									</FieldDescription>
								</Field>
								<Field>
									<FieldLabel htmlFor="quote-company">
										{quoteChannel === "DIRECT"
											? "General contractor"
											: "Distributor"}
									</FieldLabel>
									<CompanyPicker
										id="quote-company"
										value={quoteCompanyId}
										onValueChange={setQuoteCompanyId}
										placeholder={
											quoteChannel === "DIRECT"
												? "Who are we bidding to?"
												: "Which distributor?"
										}
										selected={
											quoteChannel === "DIRECT" &&
											current.gc &&
											quoteCompanyId === current.gc.id
												? { value: current.gc.id, label: current.gc.name }
												: undefined
										}
									/>
								</Field>
								<div className="grid grid-cols-2 gap-3">
									<Field>
										<FieldLabel>Quote amount ($)</FieldLabel>
										<Input
											inputMode="decimal"
											value={quoteAmount}
											onChange={(event) => setQuoteAmount(event.target.value)}
										/>
									</Field>
									<Field>
										<FieldLabel>Bid date</FieldLabel>
										<Input
											type="date"
											value={quoteBidDate}
											onChange={(event) => setQuoteBidDate(event.target.value)}
										/>
									</Field>
								</div>
								<Button
									size="sm"
									disabled={createQuote.isPending || !quoteCompanyId}
									onClick={() => {
										const amount = numberOrNull(quoteAmount);
										createQuote.mutate({
											name: `${current.name} · ${quoteChannel === "DIRECT" ? "direct" : "distributor"}`,
											companyId: quoteCompanyId,
											ownerId: current.owner?.id ?? users.data?.[0]?.id ?? "",
											stage: "DEMO_BOOKED",
											amountCents:
												amount === null ? null : Math.round(amount * 100),
											expectedCloseDate: dateOrNull(quoteBidDate),
											projectId: id,
											channel: quoteChannel,
										});
									}}
								>
									{createQuote.isPending ? (
										<Spinner data-icon="inline-start" />
									) : null}
									Add quote
								</Button>
							</FieldGroup>
						) : null}

						{current.deals.length === 0 && !quoteOpen ? (
							<p className="text-muted-foreground text-sm">
								No quotes yet. Add one when someone asks for a number — a
								distributor, or you bidding direct. Each one gets its own clock
								from its bid date.
							</p>
						) : (
							<ul className="divide-y text-sm">
								{current.deals.map((deal) => (
									<li
										key={deal.id}
										className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
									>
										<Link
											href={`${workspaceUrl("/deals")}?record=deal:${deal.id}`}
											className="font-medium hover:underline"
										>
											{deal.company.name}
										</Link>
										<span className="text-muted-foreground text-xs uppercase">
											{deal.channel === "DIRECT" ? "Direct" : "Distributor"}
										</span>
										<span className="ml-auto flex flex-wrap gap-x-3 text-muted-foreground">
											{deal.amount !== null ? (
												<span className="tabular-nums">
													{formatProjectValue(deal.amount)}
												</span>
											) : null}
											{deal.expectedCloseDate ? (
												<span>
													Bid <LocalDay date={deal.expectedCloseDate} />
												</span>
											) : null}
											<span>{dealStageLabel(deal.stage as DealStage)}</span>
										</span>
									</li>
								))}
							</ul>
						)}
					</Section>
				</div>
			</div>
			<ComposeDialog
				open={compose !== null}
				onOpenChange={(open) => {
					if (!open) setCompose(null);
				}}
				context={compose ?? {}}
			/>
		</div>
	);
}
