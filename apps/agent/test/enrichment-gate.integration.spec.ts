import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { REQUESTED_ENRICHMENT_PAYLOAD } from "@crm/db/agent-enrichment";
import { skipUnrequestedContactEnrichment } from "../agent/lib/enrichment-gate";
import { claimDue } from "../agent/lib/tasks";

const RESEARCH = { except: ["brand", "portrait"] } as const;

let autoFlag: string | undefined;

async function clear() {
	await db.agentTask.deleteMany({
		where: { reason: { startsWith: "enrich-gate-" } },
	});
	await db.contact.deleteMany({
		where: { email: { startsWith: "enrich-gate-" } },
	});
}

beforeEach(async () => {
	autoFlag = process.env.AUTO_CONTACT_ENRICHMENT;
	delete process.env.AUTO_CONTACT_ENRICHMENT;
	await clear();
});

afterEach(async () => {
	await clear();
	if (autoFlag === undefined) {
		delete process.env.AUTO_CONTACT_ENRICHMENT;
	} else {
		process.env.AUTO_CONTACT_ENRICHMENT = autoFlag;
	}
});

async function person() {
	return db.contact.create({
		data: {
			firstName: "Gate",
			email: `enrich-gate-${crypto.randomUUID()}@example.test`,
		},
		select: { id: true },
	});
}

async function queueIdentify(
	contactId: string,
	payload: Record<string, unknown> | null,
) {
	return db.agentTask.create({
		data: {
			contactId,
			kind: "identify",
			reason: "enrich-gate-test",
			dueAt: new Date(Date.now() - 1000),
			priority: 100,
			budget: 4,
			payload: payload ?? undefined,
		},
		select: { id: true },
	});
}

describe("contact enrichment dispatch gate", () => {
	it("does not claim an unrequested identify when requestedOnly is set", async () => {
		const contact = await person();
		const auto = await queueIdentify(contact.id, null);
		const requested = await queueIdentify(contact.id, {
			...REQUESTED_ENRICHMENT_PAYLOAD,
		});

		const claimed = await claimDue(10, {
			only: ["identify"],
			requestedOnly: true,
		});

		expect(claimed.map((task) => task.id)).toEqual([requested.id]);
		expect(claimed.map((task) => task.id)).not.toContain(auto.id);
	});

	it("closes leftover auto identify rows without starting a session", async () => {
		const contact = await person();
		const auto = await queueIdentify(contact.id, null);
		const requested = await queueIdentify(contact.id, {
			...REQUESTED_ENRICHMENT_PAYLOAD,
		});

		expect(await skipUnrequestedContactEnrichment([contact.id])).toBe(1);

		const autoRow = await db.agentTask.findUnique({ where: { id: auto.id } });
		const requestedRow = await db.agentTask.findUnique({
			where: { id: requested.id },
		});

		expect(autoRow?.finishedAt).not.toBeNull();
		expect(requestedRow?.finishedAt).toBeNull();
	});

	it("still claims other research kinds", async () => {
		const task = await db.agentTask.create({
			data: {
				kind: "workspace-profile",
				reason: "enrich-gate-other",
				dueAt: new Date(Date.now() - 1000),
				priority: 500,
				budget: 4,
			},
			select: { id: true },
		});

		const claimed = await claimDue(10, {
			...RESEARCH,
			requestedOnly: true,
		});

		expect(claimed.map((row) => row.id)).toContain(task.id);

		await db.agentTask.delete({ where: { id: task.id } });
	});
});
