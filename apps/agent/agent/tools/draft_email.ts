import { defineTool } from "eve/tools";
import { z } from "zod";
import { crmPost } from "../lib/crm-api";

export default defineTool({
	description:
		"Write an email into John's Gmail Drafts folder. Nothing is sent; John reads it there and sends it or rewrites it. Load the drafting-for-john skill first and write in his voice. Give the reason you are drafting it — that reason appears in his morning brief.",
	inputSchema: z.object({
		to: z.array(z.string().email()).min(1),
		cc: z.array(z.string().email()).default([]),
		subject: z.string().trim().min(1).max(200),
		body: z.string().trim().min(1).max(20_000),
		reason: z.string().trim().min(1).max(500),
		gmailThreadId: z.string().nullable().default(null),
		contactId: z.string().nullable().default(null),
		companyId: z.string().nullable().default(null),
		projectId: z.string().nullable().default(null),
		dealId: z.string().nullable().default(null),
	}),
	async execute(input) {
		return crmPost("/writes/draft-email", input);
	},
});
