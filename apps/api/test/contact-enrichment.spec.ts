import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { REQUESTED_ENRICHMENT_PAYLOAD } from "@crm/db/agent-enrichment";
import { AgentTriggerService } from "../src/agent/agent-trigger.service";

const suffix = process.env.TEST_RUN_ID ?? "contact-enrichment-spec";
const email = `enrich-${suffix}@example.test`;
const reason = `A rep asked for a fresh look (${suffix})`;

const agent = new AgentTriggerService(db);

let contactId: string;
let autoFlag: string | undefined;
let bridgeSecret: string | undefined;

async function clean() {
	if (contactId) await db.agentTask.deleteMany({ where: { contactId } });
	await db.contact.deleteMany({ where: { email } });
}

beforeAll(async () => {
	autoFlag = process.env.AUTO_CONTACT_ENRICHMENT;
	bridgeSecret = process.env.AGENT_BRIDGE_SECRET;
	delete process.env.AUTO_CONTACT_ENRICHMENT;
	process.env.AGENT_BRIDGE_SECRET = "";

	await db.contact.deleteMany({ where: { email } });
	const contact = await db.contact.create({
		data: { firstName: "Enrich", email },
		select: { id: true },
	});
	contactId = contact.id;
});

afterAll(async () => {
	await clean();

	if (autoFlag === undefined) {
		delete process.env.AUTO_CONTACT_ENRICHMENT;
	} else {
		process.env.AUTO_CONTACT_ENRICHMENT = autoFlag;
	}

	if (bridgeSecret === undefined) {
		delete process.env.AGENT_BRIDGE_SECRET;
	} else {
		process.env.AGENT_BRIDGE_SECRET = bridgeSecret;
	}
});

describe("automatic contact enrichment", () => {
	it("does not queue identify when the flag is off", async () => {
		expect(await agent.contactCreated(contactId, "Added by a rep")).toBe(false);

		expect(
			await db.agentTask.count({
				where: { contactId, kind: "identify", finishedAt: null },
			}),
		).toBe(0);
	});

	it("queues a requested identify when a rep asks", async () => {
		expect(await agent.contactCreated(contactId, reason, true)).toBe(true);

		const task = await db.agentTask.findFirst({
			where: { contactId, kind: "identify", finishedAt: null },
			select: { payload: true, reason: true },
		});

		expect(task?.payload).toEqual(REQUESTED_ENRICHMENT_PAYLOAD);
		expect(task?.reason).toBe(reason);

		expect(await agent.contactCreated(contactId, reason, true)).toBe(false);
	});
});
