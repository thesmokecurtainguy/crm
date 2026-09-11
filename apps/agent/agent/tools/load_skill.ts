import { db } from "@crm/db";
import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
	description:
		"Load a skill by name (drafting-for-john, quote-cadence, box-lunch, lead-qualification, reading-a-firm-website, evidence, identity-matching, writing-a-brief, data-boundaries). Returns John's current version — he edits these in Settings → Skills — which outranks the copy shipped with the agent. Call it before acting on anything the skill covers. Free.",
	inputSchema: z.object({
		name: z.string().trim().min(1),
	}),
	async execute({ name }) {
		const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
		const skill = await db.agentSkill.findUnique({
			where: { slug },
			select: {
				slug: true,
				title: true,
				description: true,
				body: true,
				updatedAt: true,
			},
		});
		if (!skill) {
			const known = await db.agentSkill.findMany({ select: { slug: true } });
			return { found: false as const, known: known.map((k) => k.slug) };
		}
		return { found: true as const, ...skill };
	},
});
