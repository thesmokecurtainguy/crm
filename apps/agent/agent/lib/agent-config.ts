import type { AgentModelSetting } from "@crm/db/settings";

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const AGENT = {
	limits: {
		maxInputTokensPerSession: 80_000,
		maxOutputTokensPerSession: 8_000,
		sessionTimeoutMs: 30 * DAY_MS,
	},
	lanes: {
		enrichment: {
			id: "contact-enrichment",
			purpose: "enrichment",
			endpoint: "/internal/crm/enrich-contact",
		},
		assistant: {
			id: "crm-assistant",
			purpose: "builder",
			endpoint: "/internal/crm/builder-dispatch",
		},
	},
} as const;

export interface LaneModel {
	model: string;
	modelContextWindowTokens: number;
}

export function modelForLane(
	purpose: string | null,
	enrichment: AgentModelSetting,
	assistant: AgentModelSetting | null,
): LaneModel | null {
	if (purpose === AGENT.lanes.enrichment.purpose) {
		return {
			model: enrichment.id,
			modelContextWindowTokens: enrichment.contextWindowTokens,
		};
	}

	if (!assistant || assistant.isDefault) return null;

	return {
		model: assistant.id,
		modelContextWindowTokens: assistant.contextWindowTokens,
	};
}
