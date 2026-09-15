import { describe, expect, it } from "bun:test";
import { quoteCheckpointRequest } from "../src/quote-checkpoint-request";

describe("quoteCheckpointRequest", () => {
	it("accepts a deal id", () => {
		expect(quoteCheckpointRequest.parse({ dealId: "deal_1" })).toEqual({
			dealId: "deal_1",
		});
	});

	it("refuses a blank deal id", () => {
		expect(quoteCheckpointRequest.safeParse({ dealId: "  " }).success).toBe(
			false,
		);
	});
});
