import { describe, expect, it } from "bun:test";
import {
	DEFAULT_AGENT_MODEL,
	DEFAULT_ENRICHMENT_MODEL,
	isExpensiveReasoningModel,
	resolveAgentModel,
	resolveEnrichmentModel,
} from "../src/settings";

describe("isExpensiveReasoningModel", () => {
	it("blocks the production grok reasoning ids", () => {
		expect(isExpensiveReasoningModel("spacexai/grok-4.20-reasoning")).toBe(
			true,
		);
		expect(isExpensiveReasoningModel("spacexai/grok-4.20-multi-agent")).toBe(
			true,
		);
		expect(isExpensiveReasoningModel("spacexai/grok-4.5")).toBe(true);
	});

	it("allows the cheap enrichment default and the assistant default", () => {
		expect(isExpensiveReasoningModel(DEFAULT_ENRICHMENT_MODEL.id)).toBe(false);
		expect(isExpensiveReasoningModel(DEFAULT_AGENT_MODEL.id)).toBe(false);
		expect(
			isExpensiveReasoningModel("spacexai/grok-4.1-fast-non-reasoning"),
		).toBe(false);
		expect(isExpensiveReasoningModel("spacexai/grok-4.20-non-reasoning")).toBe(
			false,
		);
	});
});

describe("resolveAgentModel", () => {
	it("uses the env model when it is set", () => {
		expect(
			resolveAgentModel({
				storedId: "spacexai/grok-4.20-reasoning",
				envModel: "spacexai/grok-4.1-fast-non-reasoning",
			}),
		).toEqual({
			id: "spacexai/grok-4.1-fast-non-reasoning",
			contextWindowTokens: DEFAULT_AGENT_MODEL.contextWindowTokens,
			isDefault: false,
		});
	});

	it("ignores a stored reasoning model and uses the default", () => {
		expect(
			resolveAgentModel({
				storedId: "spacexai/grok-4.20-reasoning",
				storedContextWindow: 2_000_000,
			}),
		).toEqual({ ...DEFAULT_AGENT_MODEL, isDefault: true });
	});

	it("keeps a stored non-reasoning model", () => {
		expect(
			resolveAgentModel({
				storedId: "anthropic/claude-sonnet-5",
				storedContextWindow: 200_000,
			}),
		).toEqual({
			id: "anthropic/claude-sonnet-5",
			contextWindowTokens: 200_000,
			isDefault: false,
		});
	});
});

describe("resolveEnrichmentModel", () => {
	it("uses the cheap default when env is empty", () => {
		expect(resolveEnrichmentModel({})).toEqual({
			...DEFAULT_ENRICHMENT_MODEL,
			isDefault: true,
		});
	});

	it("ignores a reasoning env id", () => {
		expect(
			resolveEnrichmentModel({
				envModel: "spacexai/grok-4.20-reasoning",
			}),
		).toEqual({ ...DEFAULT_ENRICHMENT_MODEL, isDefault: true });
	});

	it("keeps a cheap env override", () => {
		expect(
			resolveEnrichmentModel({
				envModel: "spacexai/grok-4.1-fast-non-reasoning",
				envContextWindow: 1_000_000,
			}),
		).toEqual({
			id: "spacexai/grok-4.1-fast-non-reasoning",
			contextWindowTokens: 1_000_000,
			isDefault: false,
		});
	});

	it("does not follow the CRM assistant model", () => {
		expect(DEFAULT_ENRICHMENT_MODEL.id).not.toBe(DEFAULT_AGENT_MODEL.id);
	});
});
