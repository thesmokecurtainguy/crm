import { defineTool } from "eve/tools";
import { z } from "zod";

const TIMEOUT_MS = 12_000;
const MAX_CHARS = 12_000;

export default defineTool({
	description:
		"Fetch a public web page and return its readable text plus the links on it. Use it to read a company's own site — the homepage for what they do, and their People/Team/Staff/Leadership page for names and titles. Public pages only; it cannot log in anywhere.",
	inputSchema: z.object({
		url: z.string().url(),
		maxChars: z.number().int().min(1000).max(MAX_CHARS).default(6000),
	}),
	async execute({ url, maxChars }) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
		try {
			const response = await fetch(url, {
				redirect: "follow",
				signal: controller.signal,
				headers: {
					"user-agent":
						"Mozilla/5.0 (compatible; CRM reader; +https://crm.johnmcphail.net)",
					accept: "text/html,*/*;q=0.5",
				},
			});
			if (!response.ok) {
				return { ok: false, status: response.status, url: response.url || url };
			}
			const html = await response.text();
			const links = linksOf(html, response.url || url);
			const text = textOf(html).slice(0, maxChars);
			return { ok: true, url: response.url || url, text, links };
		} catch (error) {
			return {
				ok: false,
				url,
				error: error instanceof Error ? error.message : String(error),
			};
		} finally {
			clearTimeout(timer);
		}
	},
});

function textOf(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(p|div|tr|li|h[1-6]|section|article|header|footer)>/gi, "\n")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/[ \t]+/g, " ")
		.replace(/\n\s*\n+/g, "\n")
		.trim();
}

const PEOPLE_HINT =
	/(team|people|staff|leadership|about|who-we-are|our-firm|principals|directory)/i;

function linksOf(html: string, base: string): { text: string; url: string }[] {
	const out = new Map<string, string>();
	const re = /<a\s+[^>]*href="([^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
	let match: RegExpExecArray | null = re.exec(html);
	while (match && out.size < 60) {
		const href = match[1] ?? "";
		const label = (match[2] ?? "")
			.replace(/<[^>]+>/g, " ")
			.replace(/\s+/g, " ")
			.trim();
		try {
			const url = new URL(href, base);
			const sameSite =
				url.hostname.replace(/^www\./, "") ===
				new URL(base).hostname.replace(/^www\./, "");
			if (
				sameSite &&
				(PEOPLE_HINT.test(url.pathname) || PEOPLE_HINT.test(label))
			) {
				out.set(url.toString(), label || url.pathname);
			}
		} catch {}
		match = re.exec(html);
	}
	return [...out.entries()].map(([url, text]) => ({ text, url }));
}
