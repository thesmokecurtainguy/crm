import { defineTool } from "eve/tools";
import { z } from "zod";
import { crmCall } from "../lib/crm-api";

export default defineTool({
	description:
		"Assign a person or a firm to a project with a role — 'Project architect', 'Project manager', 'Spec writer', 'General contractor', 'Owner's rep'. Use it when John names who is on a project, or when a firm's team page or an email names the project architect. One of contactId or companyId, plus the role. Re-adding a contact updates the role.",
	inputSchema: z.object({
		projectId: z.string(),
		contactId: z.string().optional(),
		companyId: z.string().optional(),
		role: z.string().trim().min(1).max(80),
		note: z.string().trim().max(500).nullable().default(null),
	}),
	async execute(input) {
		return crmCall<{ id: string; created: boolean }>(
			"/projects/participants",
			input,
		);
	},
});
