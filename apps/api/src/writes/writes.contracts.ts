import { AgentWriteKind, AgentWriteStatus } from "@crm/db";
import { z } from "zod";

const email = z.string().trim().email();
const isoDate = z.string().datetime({ offset: true });

const links = {
	contactId: z.string().nullable().optional(),
	companyId: z.string().nullable().optional(),
	projectId: z.string().nullable().optional(),
	dealId: z.string().nullable().optional(),
};

export const draftEmailInput = z.object({
	to: z.array(email).min(1),
	cc: z.array(email).default([]),
	subject: z.string().trim().min(1).max(200),
	body: z.string().trim().min(1).max(20_000),
	reason: z.string().trim().min(1).max(500),
	gmailThreadId: z.string().nullable().optional(),
	...links,
});
export type DraftEmailInput = z.infer<typeof draftEmailInput>;

export const createEventInput = z.object({
	title: z.string().trim().min(1).max(200),
	description: z.string().trim().max(5000).nullable().optional(),
	start: isoDate,
	end: isoDate,
	reason: z.string().trim().min(1).max(500),
	...links,
});
export type CreateEventInput = z.infer<typeof createEventInput>;

export const proposeTodoInput = z.object({
	title: z.string().trim().min(1).max(200),
	details: z.string().trim().max(5000).nullable().optional(),
	due: isoDate,
	minutes: z.number().int().min(15).max(240).default(30),
	reason: z.string().trim().min(1).max(500),
	...links,
});
export type ProposeTodoInput = z.infer<typeof proposeTodoInput>;

export const moveEventInput = z.object({
	eventId: z.string().trim().min(1),
	start: isoDate,
	end: isoDate,
	reason: z.string().trim().min(1).max(500),
});
export type MoveEventInput = z.infer<typeof moveEventInput>;

export const writeListInput = z.object({
	kind: z.enum(AgentWriteKind).optional(),
	since: isoDate.optional(),
	limit: z.number().int().min(1).max(200).default(50),
});
export type WriteListInput = z.infer<typeof writeListInput>;

export const writeIdInput = z.object({ id: z.string() });

export const writeResultOutput = z.object({
	id: z.string(),
	draftId: z.string().optional(),
	eventId: z.string().optional(),
	url: z.string().nullable(),
});

const ref = z.object({ id: z.string(), name: z.string() }).nullable();

export const writeRowOutput = z.object({
	id: z.string(),
	kind: z.enum(AgentWriteKind),
	status: z.enum(AgentWriteStatus),
	reason: z.string(),
	summary: z.string(),
	externalId: z.string().nullable(),
	externalUrl: z.string().nullable(),
	contact: z
		.object({
			id: z.string(),
			firstName: z.string(),
			lastName: z.string().nullable(),
		})
		.nullable(),
	company: ref,
	project: ref,
	deal: ref,
	startsAt: z.string().nullable(),
	endsAt: z.string().nullable(),
	createdAt: z.string(),
});

export const writeListOutput = z.array(writeRowOutput);
