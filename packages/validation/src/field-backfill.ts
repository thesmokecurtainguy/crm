import { z } from "zod";

export const fieldBackfillPayload = z.object({
	entity: z.enum(["COMPANY", "CONTACT", "DEAL"]),
	keys: z.array(z.string()).min(1),
	requested: z.literal(true).optional(),
});

export type FieldBackfillPayload = z.infer<typeof fieldBackfillPayload>;
