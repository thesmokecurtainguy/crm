import { describe, expect, it } from "bun:test";
import {
	DEFAULT_AGENT_MODEL,
	DEFAULT_ENRICHMENT_MODEL,
} from "@crm/db/settings";
import { AGENT, modelForLane } from "../agent/lib/agent-config";

describe("modelForLane", () => {
	it("keeps enrichment on the cheap model", () => {
		expect(
			modelForLane("enrichment", DEFAULT_ENRICHMENT_MODEL, {
				...DEFAULT_AGENT_MODEL,
				isDefault: false,
			}),
		).toEqual({
			model: DEFAULT_ENRICHMENT_MODEL.id,
			modelContextWindowTokens: DEFAULT_ENRICHMENT_MODEL.contextWindowTokens,
		});
	});

	it("does not hand enrichment the assistant model", () => {
		const chosen = modelForLane("enrichment", DEFAULT_ENRICHMENT_MODEL, {
			id: "spacexai/grok-4.20-non-reasoning",
			contextWindowTokens: 2_000_000,
			isDefault: false,
		});
		expect(chosen?.model).toBe(DEFAULT_ENRICHMENT_MODEL.id);
		expect(chosen?.model).not.toBe(DEFAULT_AGENT_MODEL.id);
	});

	it("uses the assistant model for chat", () => {
		expect(
			modelForLane(AGENT.lanes.assistant.purpose, DEFAULT_ENRICHMENT_MODEL, {
				...DEFAULT_AGENT_MODEL,
				isDefault: false,
			}),
		).toEqual({
			model: DEFAULT_AGENT_MODEL.id,
			modelContextWindowTokens: DEFAULT_AGENT_MODEL.contextWindowTokens,
		});
	});
});
