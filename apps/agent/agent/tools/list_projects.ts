import { db, type Prisma } from "@crm/db";
import type { ProjectStage } from "@crm/db/enums";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
	description:
		"List building projects with filters: triage (LEAD, QUALIFIED, WATCH; ARCHIVED lists archived ones), stage, state code, architect name, minimum value, and changedSince (ISO date). Returns up to 200 with id, name, stage, triage, city/state, value, architect, GC, bid date, last ConstructConnect update and reason, and how many people are assigned. Use it before any request that spans many projects ('every lead in Florida over $20M'). Free.",
	inputSchema: z.object({
		leadStatus: z.enum(["LEAD", "QUALIFIED", "WATCH", "ARCHIVED"]).optional(),
		includeArchived: z.boolean().default(false),
		stage: z.string().optional(),
		stateCode: z.string().length(2).optional(),
		architect: z.string().optional(),
		minValue: z.number().optional(),
		changedSince: z.string().optional(),
		limit: z.number().int().min(1).max(200).default(100),
	}),
	async execute({
		leadStatus,
		includeArchived,
		stage,
		stateCode,
		architect,
		minValue,
		changedSince,
		limit,
	}) {
		const since = changedSince ? new Date(changedSince) : null;
		const archivedOnly = leadStatus === "ARCHIVED";
		const where: Prisma.ProjectWhereInput = archivedOnly
			? { archivedAt: { not: null } }
			: includeArchived
				? {}
				: { archivedAt: null };
		if (leadStatus && leadStatus !== "ARCHIVED") where.leadStatus = leadStatus;
		if (stage) where.stage = stage as ProjectStage;
		if (stateCode) where.stateCode = stateCode.toUpperCase();
		if (architect)
			where.architect = { name: { contains: architect, mode: "insensitive" } };
		if (minValue) where.value = { gte: minValue };
		if (since && !Number.isNaN(since.getTime()))
			where.lastUpdateAt = { gte: since };
		const rows = await db.project.findMany({
			where,
			orderBy: [{ lastUpdateAt: { sort: "desc", nulls: "last" } }],
			take: limit,
			select: {
				id: true,
				name: true,
				externalId: true,
				stage: true,
				leadStatus: true,
				city: true,
				stateCode: true,
				value: true,
				floors: true,
				units: true,
				category: true,
				bidDate: true,
				lastUpdateAt: true,
				lastUpdateReason: true,
				watchUntil: true,
				architect: { select: { id: true, name: true } },
				gc: { select: { id: true, name: true } },
				_count: { select: { projectParticipants: true, deals: true } },
			},
		});
		return {
			count: rows.length,
			projects: rows.map((p) => ({
				id: p.id,
				name: p.name,
				constructConnectId: p.externalId,
				stage: p.stage,
				triage: p.leadStatus,
				city: p.city,
				stateCode: p.stateCode,
				value: p.value === null ? null : p.value.toNumber(),
				floors: p.floors,
				units: p.units,
				category: p.category,
				bidDate: p.bidDate,
				lastUpdateAt: p.lastUpdateAt,
				lastUpdateReason: p.lastUpdateReason,
				watchUntil: p.watchUntil,
				architect: p.architect,
				gc: p.gc,
				peopleAssigned: p._count.projectParticipants,
				quotes: p._count.deals,
			})),
		};
	},
});
