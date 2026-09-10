import { LeadStatus, ProjectStage } from "@crm/db/enums";
import type { StatusTone } from "@crm/ui/components/status-indicator";

type Presentation = { label: string; tone: StatusTone };

const STAGE_ORDER = [
	ProjectStage.UNKNOWN,
	ProjectStage.PRE_DESIGN,
	ProjectStage.SCHEMATIC_DESIGN,
	ProjectStage.DESIGN_DEVELOPMENT,
	ProjectStage.CONSTRUCTION_DOCUMENTS,
	ProjectStage.BIDDING,
	ProjectStage.UNDER_CONSTRUCTION,
	ProjectStage.WON,
	ProjectStage.LOST,
] as const;

const STAGE_PRESENTATION: Record<ProjectStage, Presentation> = {
	UNKNOWN: { label: "Unknown", tone: "neutral" },
	PRE_DESIGN: { label: "Pre-design", tone: "neutral" },
	SCHEMATIC_DESIGN: { label: "Schematic design", tone: "info" },
	DESIGN_DEVELOPMENT: { label: "Design development", tone: "info" },
	CONSTRUCTION_DOCUMENTS: { label: "Construction documents", tone: "warning" },
	BIDDING: { label: "Bidding", tone: "warning" },
	UNDER_CONSTRUCTION: { label: "Under construction", tone: "neutral" },
	WON: { label: "Won", tone: "success" },
	LOST: { label: "Lost", tone: "error" },
};

const LEAD_PRESENTATION: Record<LeadStatus, Presentation> = {
	LEAD: { label: "Lead", tone: "neutral" },
	WATCH: { label: "Watching", tone: "warning" },
	QUALIFIED: { label: "Qualified", tone: "success" },
};

export const PROJECT_STAGE_OPTIONS = STAGE_ORDER.map((value) => ({
	value,
	label: STAGE_PRESENTATION[value].label,
}));

export const LEAD_STATUS_OPTIONS = (
	[LeadStatus.LEAD, LeadStatus.WATCH, LeadStatus.QUALIFIED] as const
).map((value) => ({ value, label: LEAD_PRESENTATION[value].label }));

export function projectStageLabel(stage: ProjectStage): string {
	return STAGE_PRESENTATION[stage].label;
}

export function projectStageTone(stage: ProjectStage): StatusTone {
	return STAGE_PRESENTATION[stage].tone;
}

export function leadStatusLabel(status: LeadStatus): string {
	return LEAD_PRESENTATION[status].label;
}

export function leadStatusTone(status: LeadStatus): StatusTone {
	return LEAD_PRESENTATION[status].tone;
}

export const LOST_REASON_OPTIONS = [
	{ value: "PRICED_TOO_HIGH", label: "Priced too high" },
	{ value: "COMPETITOR_SPECIFIED", label: "Competitor specified" },
	{ value: "DISTRIBUTOR_WENT_ELSEWHERE", label: "Distributor went elsewhere" },
	{ value: "PROJECT_DIED", label: "Project died" },
	{ value: "NO_DECISION", label: "No decision" },
] as const;

export const COMPETITOR_CONFIDENCE_OPTIONS = [
	{ value: "RUMOR", label: "Rumor" },
	{ value: "SECONDHAND", label: "Secondhand" },
	{ value: "CONFIRMED", label: "Confirmed" },
] as const;

export function formatProjectValue(value: number | null): string | null {
	if (value === null) return null;
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: "USD",
		notation: value >= 1_000_000 ? "compact" : "standard",
		maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
	}).format(value);
}

export function constructConnectUrl(externalId: string | null): string | null {
	if (!externalId || !/^\d+$/.test(externalId)) return null;
	return `https://insight.cmdgroup.com/Project/Home/ProjectInformation/${externalId}/1`;
}
