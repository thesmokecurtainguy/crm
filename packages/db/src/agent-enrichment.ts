const MINUTE_MS = 60_000;

export const CONTACT_ENRICHMENT_KINDS = [
	"identify",
	"recheck",
	"meeting-prep",
] as const;

export type ContactEnrichmentKind = (typeof CONTACT_ENRICHMENT_KINDS)[number];

export const ENRICHMENT = {
	auto: { env: "AUTO_CONTACT_ENRICHMENT" },
	model: { env: "AGENT_ENRICHMENT_MODEL" },
	identify: { budget: 4 },
	onDemand: { maxContacts: 10, standDownMs: 2 * MINUTE_MS },
} as const;

export const REQUESTED_ENRICHMENT_PAYLOAD = { requested: true } as const;

export function isContactEnrichmentKind(
	kind: string,
): kind is ContactEnrichmentKind {
	return (CONTACT_ENRICHMENT_KINDS as readonly string[]).includes(kind);
}

export function autoContactEnrichmentEnabled(
	env: NodeJS.ProcessEnv = process.env,
): boolean {
	const value = env.AUTO_CONTACT_ENRICHMENT?.trim().toLowerCase();
	return value === "1" || value === "true";
}

export function isRequestedEnrichmentPayload(value: unknown): boolean {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	return (value as { requested?: unknown }).requested === true;
}
