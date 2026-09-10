const KEY = process.env.CRM_API_KEY?.trim();
const BASE = (process.env.API_URL ?? "").replace(/\/$/, "");

export type CrmWrite =
	| {
			ok: true;
			id: string;
			draftId?: string;
			eventId?: string;
			url: string | null;
	  }
	| { ok: false; error: string };

export function writesEnabled(): boolean {
	return Boolean(KEY && BASE);
}

export async function crmPost(path: string, body: unknown): Promise<CrmWrite> {
	if (!KEY || !BASE) {
		return {
			ok: false,
			error:
				"Write tools are not configured on this install (CRM_API_KEY or API_URL missing).",
		};
	}
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 20_000);
	try {
		const response = await fetch(`${BASE}/rest${path}`, {
			method: "POST",
			headers: { "content-type": "application/json", "x-api-key": KEY },
			body: JSON.stringify(body),
			signal: controller.signal,
		});
		const text = await response.text();
		let parsed: unknown = null;
		try {
			parsed = text ? JSON.parse(text) : null;
		} catch {}
		if (!response.ok) {
			const message =
				(parsed as { message?: string } | null)?.message ??
				(parsed as { error?: { message?: string } } | null)?.error?.message ??
				text.slice(0, 300);
			return { ok: false, error: `${response.status}: ${message}` };
		}
		const result = parsed as {
			id: string;
			draftId?: string;
			eventId?: string;
			url?: string | null;
		};
		return {
			ok: true,
			id: result.id,
			draftId: result.draftId,
			eventId: result.eventId,
			url: result.url ?? null,
		};
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		};
	} finally {
		clearTimeout(timer);
	}
}
