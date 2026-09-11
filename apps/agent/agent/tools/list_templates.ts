import { db } from "@crm/db";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
	description:
		"List John's email templates: name, when to use it, subject and body with {{placeholders}}. When a template fits the email you are about to draft, start from its wording and fill the placeholders from the record — it is John's own voice. Free.",
	inputSchema: z.object({}),
	async execute() {
		const templates = await db.emailTemplate.findMany({
			where: { archivedAt: null },
			orderBy: { name: "asc" },
			select: {
				id: true,
				name: true,
				description: true,
				subject: true,
				body: true,
			},
		});
		return { templates };
	},
});
