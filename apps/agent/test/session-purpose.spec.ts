import { describe, expect, it } from "bun:test";
import {
	assertNotEnrichment,
	assertResearchPurpose,
	purposeOf,
} from "../agent/lib/session-purpose";

const context = (attributes: Record<string, string> = {}) => ({
	session: {
		auth: {
			current: { attributes },
			initiator: { attributes: {} },
		},
	},
});

describe("session purpose for enrichment", () => {
	it("treats an identify task as enrichment", () => {
		const ctx = context({ taskKind: "identify" });
		expect(purposeOf(ctx)).toBe("enrichment");
		expect(() => assertResearchPurpose(ctx)).not.toThrow();
		expect(() => assertNotEnrichment(ctx)).toThrow();
	});

	it("keeps ordinary research off the enrichment path", () => {
		const ctx = context();
		expect(purposeOf(ctx)).toBe("research");
		expect(() => assertNotEnrichment(ctx)).not.toThrow();
	});

	it("does not let a builder session look like enrichment", () => {
		const ctx = context({ purpose: "builder", taskKind: "identify" });
		expect(purposeOf(ctx)).toBe("builder");
		expect(() => assertResearchPurpose(ctx)).toThrow();
	});

	it("keeps enrichment from calling draft_email", async () => {
		const source = await Bun.file(
			new URL("../agent/tools/draft_email.ts", import.meta.url),
		).text();
		expect(source).toContain("assertNotEnrichment");
	});
});
