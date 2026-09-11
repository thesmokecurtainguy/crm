import { z } from "zod";

export const skillOutput = z.object({
	slug: z.string(),
	title: z.string(),
	description: z.string(),
	body: z.string(),
	edited: z.boolean(),
	updatedAt: z.date(),
});

export const skillListOutput = z.array(skillOutput);

export const skillSlugInput = z.object({ slug: z.string() });

export const skillUpdateInput = z.object({
	slug: z.string(),
	body: z.string().min(1).max(60_000),
});
