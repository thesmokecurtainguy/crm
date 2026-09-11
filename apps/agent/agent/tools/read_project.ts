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
		"Read a building project in full: address, stage, value, floors, units, bid date, scope; the team firms (architect, GC, developer) with their full rosters; the people and firms John has assigned to THIS project under `participants` (the project architect, PM, etc. — prefer these over the roster); John's dated log; quotes; and what the agent already drafted or scheduled. Free — call it first in a project session.",
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
				projectParticipants: {
					orderBy: [{ role: "asc" }],
					select: {
						id: true,
						role: true,
						note: true,
						company: { select: { id: true, name: true, phone: true } },
						contact: {
							select: {
								id: true,
								firstName: true,
								lastName: true,
								title: true,
								email: true,
								phone: true,
								companyId: true,
							},
						},
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

		const { value, deals, projectParticipants, ...rest } = project;
		return {
			found: true as const,
			...rest,
			participants: projectParticipants,
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
