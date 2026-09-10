import { db, type Prisma } from "@crm/db";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { focusOn } from "../lib/focus";

const COMPANY = {
	id: true,
	name: true,
	domain: true,
	website: true,
	phone: true,
	city: true,
	stateCode: true,
	contacts: {
		where: { archivedAt: null },
		orderBy: [
			{ lastActivityAt: { sort: "desc" as const, nulls: "last" as const } },
		],
		take: 25,
		select: {
			id: true,
			firstName: true,
			lastName: true,
			title: true,
			email: true,
			phone: true,
			lastActivityAt: true,
		},
	},
} satisfies Prisma.CompanySelect;

export default defineTool({
	description:
		"Read a building project in full: address, stage, value, floors, units, bid date, scope, the architect, GC and developer with their people and contact ids, John's dated log on it, quotes linked to it, and what the agent has already drafted or scheduled about it. Free — call it first in a project session.",
	inputSchema: z.object({
		projectId: z.string(),
	}),
	async execute({ projectId }) {
		const project = await db.project.findUnique({
			where: { id: projectId },
			select: {
				id: true,
				name: true,
				externalId: true,
				address: true,
				city: true,
				stateCode: true,
				county: true,
				category: true,
				stage: true,
				leadStatus: true,
				watchUntil: true,
				value: true,
				floors: true,
				units: true,
				floorArea: true,
				startDate: true,
				bidDate: true,
				description: true,
				lastUpdateReason: true,
				lastUpdateAt: true,
				competitor: true,
				competitorPricing: true,
				competitorConfidence: true,
				lostReason: true,
				archivedAt: true,
				architect: { select: COMPANY },
				gc: { select: COMPANY },
				developer: { select: COMPANY },
				deals: {
					where: { archivedAt: null },
					select: {
						id: true,
						name: true,
						stage: true,
						amount: true,
						expectedCloseDate: true,
						lastActivityAt: true,
						company: { select: { id: true, name: true } },
					},
				},
				activities: {
					orderBy: { occurredAt: "desc" },
					take: 30,
					select: {
						type: true,
						subject: true,
						body: true,
						occurredAt: true,
						dueAt: true,
						completedAt: true,
						createdBy: { select: { name: true } },
					},
				},
				agentWrites: {
					orderBy: { createdAt: "desc" },
					take: 20,
					select: {
						kind: true,
						status: true,
						summary: true,
						reason: true,
						externalUrl: true,
						startsAt: true,
						createdAt: true,
					},
				},
			},
		});

		if (!project) return { found: false as const, reason: "No such project." };

		focusOn({ companyId: project.architect?.id ?? null });

		const { value, deals, ...rest } = project;
		return {
			found: true as const,
			...rest,
			value: value === null ? null : value.toNumber(),
			deals: deals.map((deal) => ({
				...deal,
				amount: deal.amount === null ? null : deal.amount.toNumber(),
			})),
			team: {
				architect: project.architect,
				gc: project.gc,
				developer: project.developer,
			},
		};
	},
});
