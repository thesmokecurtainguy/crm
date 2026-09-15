import { defineTool } from "eve/tools";
import { z } from "zod";
import { crmPost } from "../lib/crm-api";
import { assertNotEnrichment } from "../lib/session-purpose";

export default defineTool({
	description:
		"Move an event the agent created earlier (a to-do or follow-up block on the CRM calendar). It refuses to move anything a human booked. Use the eventId returned when the block was created. Give the reason.",
	inputSchema: z.object({
		eventId: z.string().trim().min(1),
		start: z.string().datetime({ offset: true }),
		end: z.string().datetime({ offset: true }),
		reason: z.string().trim().min(1).max(500),
	}),
	async execute(input, ctx) {
		assertNotEnrichment(ctx);
		return crmPost("/writes/move-event", input);
	},
});
