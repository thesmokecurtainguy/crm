import { describe, expect, it } from "bun:test";
import { checkpointFor } from "../agent/lib/quote-clocks";

describe("quote checkpoint clock", () => {
	it("names the furthest day that has passed", () => {
		expect(checkpointFor(0)).toBeNull();
		expect(checkpointFor(13)).toBeNull();
		expect(checkpointFor(14)).toBe(14);
		expect(checkpointFor(29)).toBe(14);
		expect(checkpointFor(180)).toBe(180);
	});
});
