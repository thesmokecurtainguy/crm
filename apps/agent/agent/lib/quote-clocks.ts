export const QUOTE = {
	checkpoints: [14, 30, 60, 90, 180],
} as const;

export type Checkpoint = (typeof QUOTE.checkpoints)[number];

export function checkpointFor(daysPastBid: number): Checkpoint | null {
	let reached: Checkpoint | null = null;
	for (const day of QUOTE.checkpoints) {
		if (daysPastBid >= day) reached = day;
	}
	return reached;
}
