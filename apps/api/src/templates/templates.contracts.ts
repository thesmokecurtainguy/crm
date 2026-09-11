import { z } from "zod";

export const templateOutput = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	subject: z.string(),
	body: z.string(),
	archivedAt: z.date().nullable(),
	updatedAt: z.date(),
});

export const templateListInput = z.object({
	includeArchived: z.boolean().default(false),
});

export const templateListOutput = z.array(templateOutput);

export const templateCreateInput = z.object({
	name: z.string().trim().min(1).max(120),
	description: z.string().trim().max(300).nullable().optional(),
	subject: z.string().trim().min(1).max(200),
	body: z.string().min(1).max(20_000),
});

export const templateUpdateInput = z.object({
	id: z.string(),
	data: templateCreateInput.partial(),
});

export const templateIdInput = z.object({ id: z.string() });

const context = {
	contactId: z.string().nullable().optional(),
	companyId: z.string().nullable().optional(),
	projectId: z.string().nullable().optional(),
	dealId: z.string().nullable().optional(),
};

export const templateRenderInput = z.object({
	templateId: z.string(),
	...context,
});

export const templateRenderOutput = z.object({
	subject: z.string(),
	body: z.string(),
	missing: z.array(z.string()),
});

export const templateValuesInput = z.object(context);
export const templateValuesOutput = z.record(z.string(), z.string());

const email = z.string().trim().email();

export const sendEmailInput = z.object({
	to: z.array(email).min(1),
	cc: z.array(email).default([]),
	subject: z.string().trim().min(1).max(200),
	body: z.string().trim().min(1).max(20_000),
	gmailThreadId: z.string().nullable().optional(),
	...context,
});

export const sendEmailOutput = z.object({
	sent: z.boolean(),
	gmailMessageId: z.string(),
	gmailThreadId: z.string().nullable(),
});
