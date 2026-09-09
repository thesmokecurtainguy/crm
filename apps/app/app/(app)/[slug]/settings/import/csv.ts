export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let inQuotes = false;
	const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

	for (let i = 0; i < src.length; i++) {
		const ch = src[i];
		if (inQuotes) {
			if (ch === '"') {
				if (src[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += ch;
			}
			continue;
		}
		if (ch === '"') {
			inQuotes = true;
		} else if (ch === ",") {
			row.push(field);
			field = "";
		} else if (ch === "\n" || ch === "\r") {
			if (ch === "\r" && src[i + 1] === "\n") i++;
			row.push(field);
			field = "";
			if (row.some((cell) => cell.trim() !== "")) rows.push(row);
			row = [];
		} else {
			field += ch;
		}
	}
	row.push(field);
	if (row.some((cell) => cell.trim() !== "")) rows.push(row);
	return rows;
}

export type CsvTable = { headers: string[]; rows: Record<string, string>[] };

export function toTable(parsed: string[][]): CsvTable {
	if (parsed.length === 0) return { headers: [], rows: [] };
	const headers = (parsed[0] ?? []).map((h) => h.trim());
	const rows = parsed.slice(1).map((cells) => {
		const record: Record<string, string> = {};
		headers.forEach((h, i) => {
			record[h] = (cells[i] ?? "").trim();
		});
		return record;
	});
	return { headers, rows };
}
