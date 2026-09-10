import { defineTool } from "eve/tools";
import { z } from "zod";
import { crmPost } from "../lib/crm-api";

export default defineTool({
	description:
		"Put a to-do on John's day as a timed block on the CRM calendar. Use it for things John has to do himself: call a GC, decide on a lead, sign something. Default 30 minutes. Give the reason — it is what John reads.",
	inputSchema: z.object({
		title: z.string().trim().min(1).max(200),
		details: z.string().trim().max(5000).nullable().default(null),
		due: z.string().datetime({ offset: true }),
		minutes: z.number().int().min(15).max(240).default(30),
		reason: z.string().trim().min(1).max(500),
		contactId: z.string().nullable().default(null),
		companyId: z.string().nullable().default(null),
		projectId: z.string().nullable().default(null),
		dealId: z.string().nullable().default(null),
	}),
	async execute(input) {
		return crmPost("/writes/propose-todo", input);
	},
});
