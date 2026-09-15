import { ENRICHMENT } from "@crm/db/agent-enrichment";
import { z } from "zod";

const contactId = z.string().trim().min(1).max(120);

export const requestedEnrichmentPayload = z.object({
	requested: z.literal(true),
});

export type RequestedEnrichmentPayload = z.infer<
	typeof requestedEnrichmentPayload
>;

export const enrichContactRequest = z
	.object({
		contactId: contactId.optional(),
		contactIds: z
			.array(contactId)
			.max(ENRICHMENT.onDemand.maxContacts)
			.optional(),
	})
	.transform((value, ctx) => {
		const ids = [
			...new Set(
				[value.contactId, ...(value.contactIds ?? [])].filter(
					(id): id is string => Boolean(id),
				),
			),
		];

		if (ids.length === 0) {
			ctx.addIssue({
				code: "custom",
				message: "Send one contact id, or a short list of contact ids.",
			});
			return z.NEVER;
		}

		return { contactIds: ids };
	});

export type EnrichContactRequest = z.infer<typeof enrichContactRequest>;
