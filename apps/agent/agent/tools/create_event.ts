import { defineTool } from "eve/tools";
import { z } from "zod";
import { crmPost } from "../lib/crm-api";

export default defineTool({
	description:
		"Put a block on the CRM calendar (the agent's own calendar, not John's primary or Field Planner). Use it for follow-up windows, distributor check-ins, and anything with a time. Times are ISO 8601 with offset, Eastern time. Give the reason.",
	inputSchema: z.object({
		title: z.string().trim().min(1).max(200),
		description: z.string().trim().max(5000).nullable().default(null),
		start: z.string().datetime({ offset: true }),
		end: z.string().datetime({ offset: true }),
		reason: z.string().trim().min(1).max(500),
		contactId: z.string().nullable().default(null),
		companyId: z.string().nullable().default(null),
		projectId: z.string().nullable().default(null),
		dealId: z.string().nullable().default(null),
	}),
	async execute(input) {
		return crmPost("/writes/create-event", input);
	},
});
