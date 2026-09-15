import { describe, expect, it } from "bun:test";
import { enrichContactRequest } from "../src/enrichment-request";

describe("enrichContactRequest", () => {
	it("accepts one contact id", () => {
		expect(enrichContactRequest.parse({ contactId: "c1" })).toEqual({
			contactIds: ["c1"],
		});
	});

	it("dedupes a short list", () => {
		expect(
			enrichContactRequest.parse({
				contactId: "c1",
				contactIds: ["c1", "c2"],
			}),
		).toEqual({ contactIds: ["c1", "c2"] });
	});

	it("refuses an empty body", () => {
		expect(enrichContactRequest.safeParse({}).success).toBe(false);
	});

	it("refuses more than ten ids", () => {
		expect(
			enrichContactRequest.safeParse({
				contactIds: Array.from({ length: 11 }, (_, i) => `c${i}`),
			}).success,
		).toBe(false);
	});
});
