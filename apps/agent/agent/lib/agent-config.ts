const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const AGENT = {
	limits: {
		maxInputTokensPerSession: 80_000,
		maxOutputTokensPerSession: 8_000,
		sessionTimeoutMs: 30 * DAY_MS,
	},
} as const;
