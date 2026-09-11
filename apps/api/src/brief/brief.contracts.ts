import { z } from "zod";

const item = z.object({
	title: z.string(),
	detail: z.string().nullable(),
	url: z.string().nullable(),
	kind: z.string(),
});

export const briefOutput = z.object({
	date: z.string(),
	generatedAt: z.string(),
	agentDid: z.array(item),
	needsYou: z.array(item),
	clocks: z.array(item),
	projectUpdates: z.array(item),
	today: z.array(item),
	digests: z.object({
		count: z.number(),
		projectsFound: z.number(),
		created: z.number(),
		updated: z.number(),
	}),
});

export const briefSendOutput = z.object({
	sent: z.boolean(),
	reason: z.string().optional(),
});
