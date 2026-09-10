import { defineTool } from "eve/tools";
import { z } from "zod";
import { crmCall } from "../lib/crm-api";

type FillOutcome = {
	domain: string | null;
	pattern: string | null;
	evidence: number;
	filled: number;
	skipped: number;
	reason: string | null;
};

export default defineTool({
	description:
		"Fill in missing email addresses for everyone at one company by learning the firm's address pattern from the real addresses already on file. Needs two real addresses by default; pass minEvidence 1 only when John explicitly says one is enough, and then dry-run first and tell him the pattern before committing. Each filled address is marked 'Email Source: Pattern' on the contact so it is never mistaken for a verified one.",
	inputSchema: z.object({
		companyId: z.string(),
		dryRun: z.boolean().default(false),
		minEvidence: z.number().int().min(1).max(5).default(2),
	}),
	async execute({ companyId, dryRun, minEvidence }) {
		return crmCall<FillOutcome>(
			`/companies/${encodeURIComponent(companyId)}/fill-emails`,
			{ id: companyId, dryRun, minEvidence },
		);
	},
});
