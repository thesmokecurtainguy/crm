import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { REQUESTED_ENRICHMENT_PAYLOAD } from "@crm/db/agent-enrichment";
import { AgentTriggerService } from "../src/agent/agent-trigger.service";

const suffix = process.env.TEST_RUN_ID ?? "manual-queues-spec";
const dealName = `Manual quote ${suffix}`;
const website = `manual-${suffix}.example.test`;

const agent = new AgentTriggerService(db);

let companyId: string;
let dealId: string;
let ownerId: string;
let bridgeSecret: string | undefined;

async function clean() {
	if (dealId) await db.agentTask.deleteMany({ where: { dealId } });
	if (companyId) await db.agentTask.deleteMany({ where: { companyId } });
	await db.agentTask.deleteMany({
		where: { kind: "workspace-profile", reason: { contains: suffix } },
	});
	if (dealId) await db.deal.deleteMany({ where: { id: dealId } });
	if (companyId) await db.company.deleteMany({ where: { id: companyId } });
	if (ownerId) await db.user.deleteMany({ where: { id: ownerId } });
}

beforeAll(async () => {
	bridgeSecret = process.env.AGENT_BRIDGE_SECRET;
	process.env.AGENT_BRIDGE_SECRET = "";

	ownerId = `manual-owner-${suffix}`;
	await db.user.create({
		data: {
			id: ownerId,
			name: "Manual Owner",
			email: `${ownerId}@example.test`,
		},
	});
	const company = await db.company.create({
		data: { name: `Manual Co ${suffix}`, domain: website },
		select: { id: true },
	});
	companyId = company.id;
	const deal = await db.deal.create({
		data: {
			name: dealName,
			companyId,
			ownerId,
			channel: "DIRECT",
			expectedCloseDate: new Date("2026-01-01"),
		},
		select: { id: true },
	});
	dealId = deal.id;
});

afterAll(async () => {
	await clean();

	if (bridgeSecret === undefined) {
		delete process.env.AGENT_BRIDGE_SECRET;
	} else {
		process.env.AGENT_BRIDGE_SECRET = bridgeSecret;
	}
});

describe("manual agent queues", () => {
	it("queues a requested quote-checkpoint when a rep asks", async () => {
		expect(await agent.quoteRequested(dealId, `Check ${suffix}`)).toBe(true);

		const task = await db.agentTask.findFirst({
			where: { dealId, kind: "quote-checkpoint", finishedAt: null },
			select: { payload: true },
		});
		expect(task?.payload).toMatchObject(REQUESTED_ENRICHMENT_PAYLOAD);

		expect(await agent.quoteRequested(dealId, `Check ${suffix}`)).toBe(false);
	});

	it("queues a requested workspace-profile when a rep asks", async () => {
		expect(await agent.workspaceRequested(website, `Profile ${suffix}`)).toBe(
			true,
		);

		const task = await db.agentTask.findFirst({
			where: {
				kind: "workspace-profile",
				reason: { contains: suffix },
				finishedAt: null,
			},
			select: { payload: true },
		});
		expect(task?.payload).toEqual(REQUESTED_ENRICHMENT_PAYLOAD);

		expect(await agent.workspaceRequested(website, `Profile ${suffix}`)).toBe(
			false,
		);
	});
});
