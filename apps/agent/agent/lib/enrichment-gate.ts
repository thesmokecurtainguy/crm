import { db, EnrichmentStatus } from "@crm/db";
import {
	autoContactEnrichmentEnabled,
	CONTACT_ENRICHMENT_KINDS,
	ENRICHMENT,
	isRequestedEnrichmentPayload,
	REQUESTED_ENRICHMENT_PAYLOAD,
} from "@crm/db/agent-enrichment";
import { PRIORITY } from "@crm/db/agent-tasks";
import { lockIdempotencyKey } from "@crm/db/idempotency";
import { settle } from "./enrichment";
import { completeTask } from "./tasks";

const SKIP_REASON = "Automatic contact enrichment is off.";

const SKIP_BATCH = 200;

export async function skipUnrequestedContactEnrichment(
	contactIds?: readonly string[],
): Promise<number> {
	if (autoContactEnrichmentEnabled()) return 0;

	const now = new Date();
	const rows = await db.agentTask.findMany({
		where: {
			kind: { in: [...CONTACT_ENRICHMENT_KINDS] },
			finishedAt: null,
			contactId: contactIds ? { in: [...contactIds] } : undefined,
			OR: [{ leasedUntil: null }, { leasedUntil: { lt: now } }],
		},
		select: {
			id: true,
			payload: true,
		},
		take: SKIP_BATCH,
	});

	let skipped = 0;

	for (const row of rows) {
		if (isRequestedEnrichmentPayload(row.payload)) continue;

		const subject = await completeTask(row.id, SKIP_REASON);
		if (!subject) continue;

		await settle(subject, EnrichmentStatus.SKIPPED, SKIP_REASON);
		skipped += 1;
	}

	return skipped;
}

export async function queueRequestedIdentify(
	contactId: string,
	reason: string,
): Promise<"queued" | "already" | "missing" | "recent"> {
	const contact = await db.contact.findUnique({
		where: { id: contactId },
		select: { id: true },
	});
	if (!contact) return "missing";

	return db.$transaction(async (tx) => {
		await lockIdempotencyKey(tx, `agent-task:identify:${contactId}::`);

		const recent = await tx.agentTask.findFirst({
			where: {
				kind: "identify",
				contactId,
				finishedAt: {
					gte: new Date(Date.now() - ENRICHMENT.onDemand.standDownMs),
				},
			},
			select: { id: true },
		});
		if (recent) return "recent" as const;

		const pending = await tx.agentTask.findFirst({
			where: { kind: "identify", contactId, finishedAt: null },
			select: { id: true, payload: true },
		});

		if (pending) {
			if (isRequestedEnrichmentPayload(pending.payload)) {
				return "already" as const;
			}

			await tx.agentTask.update({
				where: { id: pending.id },
				data: {
					payload: REQUESTED_ENRICHMENT_PAYLOAD,
					reason,
					priority: PRIORITY.requested,
					dueAt: new Date(),
				},
			});
			return "queued" as const;
		}

		await tx.agentTask.create({
			data: {
				contactId,
				kind: "identify",
				reason,
				priority: PRIORITY.requested,
				budget: ENRICHMENT.identify.budget,
				dueAt: new Date(),
				payload: REQUESTED_ENRICHMENT_PAYLOAD,
			},
		});
		return "queued" as const;
	});
}
