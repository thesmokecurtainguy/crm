import { describe, expect, it } from "bun:test";
import {
	autoContactEnrichmentEnabled,
	ENRICHMENT,
	isContactEnrichmentKind,
	isRequestedEnrichmentPayload,
} from "../src/agent-enrichment";

describe("autoContactEnrichmentEnabled", () => {
	it("is off when the variable is missing", () => {
		expect(autoContactEnrichmentEnabled({})).toBe(false);
	});

	it("is off for any value that is not 1 or true", () => {
		expect(autoContactEnrichmentEnabled({ AUTO_CONTACT_ENRICHMENT: "0" })).toBe(
			false,
		);
		expect(
			autoContactEnrichmentEnabled({ AUTO_CONTACT_ENRICHMENT: "yes" }),
		).toBe(false);
	});

	it("is on for 1 or true", () => {
		expect(autoContactEnrichmentEnabled({ AUTO_CONTACT_ENRICHMENT: "1" })).toBe(
			true,
		);
		expect(
			autoContactEnrichmentEnabled({ AUTO_CONTACT_ENRICHMENT: "TRUE" }),
		).toBe(true);
	});
});

describe("requested enrichment payload", () => {
	it("accepts only the requested flag", () => {
		expect(isRequestedEnrichmentPayload({ requested: true })).toBe(true);
		expect(isRequestedEnrichmentPayload({ requested: false })).toBe(false);
		expect(isRequestedEnrichmentPayload(null)).toBe(false);
		expect(isRequestedEnrichmentPayload({})).toBe(false);
	});
});

describe("contact enrichment kinds", () => {
	it("names the model sessions that spend on a person", () => {
		expect(isContactEnrichmentKind("identify")).toBe(true);
		expect(isContactEnrichmentKind("recheck")).toBe(true);
		expect(isContactEnrichmentKind("meeting-prep")).toBe(true);
		expect(isContactEnrichmentKind("brand")).toBe(false);
	});

	it("caps an on-demand request at ten contacts", () => {
		expect(ENRICHMENT.onDemand.maxContacts).toBe(10);
	});
});
