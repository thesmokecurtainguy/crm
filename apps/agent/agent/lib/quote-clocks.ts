import { db } from "@crm/db";
import { scheduleTask } from "./tasks";

const DAY = 24 * 60 * 60 * 1000;
const CHECKPOINTS = [14, 30, 60, 90, 180] as const;
const QUIET_DAYS = 7;

export type Checkpoint = (typeof CHECKPOINTS)[number];

export function checkpointFor(daysPastBid: number): Checkpoint | null {
	let reached: Checkpoint | null = null;
	for (const day of CHECKPOINTS) {
		if (daysPastBid >= day) reached = day;
	}
	return reached;
}

export async function queueQuoteCheckpoints(now = new Date()): Promise<number> {
	const quotes = await db.deal.findMany({
		where: {
			archivedAt: null,
			closedAt: null,
			channel: { not: null },
			expectedCloseDate: { not: null, lte: now },
		},
		select: {
			id: true,
			name: true,
			channel: true,
			expectedCloseDate: true,
			lastActivityAt: true,
			companyId: true,
			projectId: true,
			project: { select: { name: true } },
			company: { select: { name: true } },
		},
	});

	let queued = 0;
	for (const quote of quotes) {
		const bid = quote.expectedCloseDate as Date;
		const daysPastBid = Math.floor((now.getTime() - bid.getTime()) / DAY);
		const checkpoint = checkpointFor(daysPastBid);
		if (!checkpoint) continue;

		const checkpointAt = new Date(bid.getTime() + checkpoint * DAY);

		const acted = await db.agentWrite.findFirst({
			where: { dealId: quote.id, createdAt: { gte: checkpointAt } },
			select: { id: true },
		});
		if (acted) continue;

		const recentWrite = await db.agentWrite.findFirst({
			where: {
				dealId: quote.id,
				createdAt: { gte: new Date(now.getTime() - QUIET_DAYS * DAY) },
			},
			select: { id: true },
		});
		if (recentWrite) continue;

		const repliedSince =
			quote.lastActivityAt !== null && quote.lastActivityAt >= checkpointAt;
		if (repliedSince && checkpoint < 180) continue;

		const track =
			quote.channel === "DIRECT" ? "direct bid" : "distributor quote";
		const who =
			quote.channel === "DIRECT"
				? "John"
				: (quote.company?.name ?? "the distributor");
		await scheduleTask({
			dealId: quote.id,
			companyId: quote.companyId,
			kind: "quote-checkpoint",
			reason: `${quote.project?.name ?? quote.name}: ${track}, ${checkpoint} days past bid, nothing from ${who} since.`,
			payload: {
				checkpoint,
				daysPastBid,
				channel: quote.channel,
				projectId: quote.projectId,
			},
			dueAt: now,
			priority: checkpoint >= 180 ? 2 : 1,
		});
		queued += 1;
	}
	return queued;
}
