import { z } from "zod";

export const quoteCheckpointRequest = z.object({
	dealId: z.string().trim().min(1).max(120),
});

export type QuoteCheckpointRequest = z.infer<typeof quoteCheckpointRequest>;
