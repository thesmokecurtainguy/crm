import { db, EnrichmentStatus } from "@crm/db";
import {
	AUTO_EVENT_KIND,
	AUTO_RESEARCH_KINDS,
	autoContactEnrichmentEnabled,
	CONTACT_ENRICHMENT_KINDS,
	ENRICHMENT,
	isRequestedEnrichmentPayload,
	REQUESTED_ENRICHMENT_PAYLOAD,
} from "@crm/db/agent-enrichment";
import { PRIORITY } from "@crm/db/agent-tasks";
import { lockIdempotencyKey } from "@crm/db/idempotency";
import { WORKSPACE_ID } from "@crm/db/workspace";
import { settle } from "./enrichment";
import { completeTask } from "./tasks";

const SKIP_REASON = "Automatic agent work is off.";

const SKIP_BATCH = 200;

export async function skipUnrequestedContactEnrichment(
	contactIds?: readonly string[],
): Promise<number> {
	return skipUnrequestedAutoWork(contactIds);
}

export async function skipUnrequestedAutoWork(
	contactIds?: readonly string[],
): Promise<number> {
	const now = new Date();
	const rows = await db.agentTask.findMany({
		where: {
			kind: { in: [...AUTO_RESEARCH_KINDS, AUTO_EVENT_KIND] },
			finishedAt: null,
			contactId: contactIds ? { in: [...contactIds] } : undefined,
			OR: [{ leasedUntil: null }, { leasedUntil: { lt: now } }],
		},
		select: {
			id: true,
			kind: true,
			payload: true,
		},
		take: SKIP_BATCH,
	});

	let skipped = 0;

	for (const row of rows) {
		if (
			row.kind !== AUTO_EVENT_KIND &&
			isRequestedEnrichmentPayload(row.payload)
		) {
			continue;
		}

		if (
			row.kind !== AUTO_EVENT_KIND &&
			(CONTACT_ENRICHMENT_KINDS as readonly string[]).includes(row.kind) &&
			autoContactEnrichmentEnabled()
		) {
			continue;
		}

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

export async function queueRequestedWorkspaceProfile(
	reason: string,
): Promise<"queued" | "already" | "missing"> {
	const website = await db.organization.findUnique({
		where: { id: WORKSPACE_ID },
		select: { website: true },
	});
	if (!website?.website) return "missing";

	return db.$transaction(async (tx) => {
		await lockIdempotencyKey(tx, "agent-task:workspace-profile:::");

		const pending = await tx.agentTask.findFirst({
			where: { kind: "workspace-profile", finishedAt: null },
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
					reason: `${reason} (${website.website})`,
					priority: PRIORITY.requested,
					dueAt: new Date(),
				},
			});
			return "queued" as const;
		}

		await tx.agentTask.create({
			data: {
				kind: "workspace-profile",
				reason: `${reason} (${website.website})`,
				priority: PRIORITY.requested,
				budget: ENRICHMENT.profile.budget,
				dueAt: new Date(),
				payload: REQUESTED_ENRICHMENT_PAYLOAD,
			},
		});
		return "queued" as const;
	});
}

export async function queueRequestedQuoteCheckpoint(
	dealId: string,
	reason: string,
): Promise<"queued" | "already" | "missing"> {
	const deal = await db.deal.findUnique({
		where: { id: dealId },
		select: {
			id: true,
			name: true,
			channel: true,
			companyId: true,
			projectId: true,
			project: { select: { name: true } },
		},
	});
	if (!deal) return "missing";

	return db.$transaction(async (tx) => {
		await lockIdempotencyKey(tx, `agent-task:quote-checkpoint:::${dealId}`);

		const pending = await tx.agentTask.findFirst({
			where: { kind: "quote-checkpoint", dealId, finishedAt: null },
			select: { id: true, payload: true },
		});

		if (pending) {
			if (isRequestedEnrichmentPayload(pending.payload)) {
				return "already" as const;
			}

			await tx.agentTask.update({
				where: { id: pending.id },
				data: {
					payload: {
						...REQUESTED_ENRICHMENT_PAYLOAD,
						channel: deal.channel,
						projectId: deal.projectId,
					},
					reason,
					priority: PRIORITY.requested,
					dueAt: new Date(),
				},
			});
			return "queued" as const;
		}

		await tx.agentTask.create({
			data: {
				dealId: deal.id,
				companyId: deal.companyId,
				kind: "quote-checkpoint",
				reason,
				priority: PRIORITY.requested,
				budget: ENRICHMENT.quote.budget,
				dueAt: new Date(),
				payload: {
					...REQUESTED_ENRICHMENT_PAYLOAD,
					channel: deal.channel,
					projectId: deal.projectId,
					dealName: deal.project?.name ?? deal.name,
				},
			},
		});
		return "queued" as const;
	});
}
