"use client";

import { Button } from "@crm/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import {
	type CcProject,
	type CcTeamMember,
	isConstructConnectExport,
	parseConstructConnect,
	roleKind,
} from "./constructconnect";
import { type CsvTable, parseCsv, toTable } from "./csv";

const SOURCE_FIELD_LABEL = "Import Source";
const SOURCE_FIELD_KEY = "import_source";

const NONE = "__none__";

type Target =
	| "companyName"
	| "companyDomain"
	| "companyPhone"
	| "companyCity"
	| "companyState"
	| "companyLinkedin"
	| "firstName"
	| "lastName"
	| "fullName"
	| "email"
	| "phone"
	| "title"
	| "linkedin";

const TARGETS: { key: Target; label: string; hint?: string }[] = [
	{ key: "companyName", label: "Company name" },
	{ key: "companyDomain", label: "Company domain / website" },
	{ key: "companyPhone", label: "Company phone" },
	{ key: "companyCity", label: "Company city" },
	{ key: "companyState", label: "Company state" },
	{ key: "companyLinkedin", label: "Company LinkedIn" },
	{ key: "firstName", label: "First name" },
	{ key: "lastName", label: "Last name" },
	{
		key: "fullName",
		label: "Full name",
		hint: "Used when first/last are blank",
	},
	{ key: "email", label: "Email" },
	{ key: "phone", label: "Contact phone" },
	{ key: "title", label: "Job title" },
	{ key: "linkedin", label: "Contact LinkedIn" },
];

const AUTO: Record<Target, string[]> = {
	companyName: [
		"prospect_company_name",
		"company name",
		"company",
		"firm",
		"organization",
		"organisation",
	],
	companyDomain: [
		"prospect_company_website",
		"domain",
		"website",
		"company domain",
		"company website",
		"web",
	],
	companyPhone: [
		"company phone",
		"firm phone",
		"phone (company)",
		"main phone",
	],
	companyCity: ["company city", "firm city"],
	companyState: ["company state", "state", "firm state"],
	companyLinkedin: ["prospect_company_linkedin", "company linkedin"],
	firstName: ["prospect_first_name", "first name", "firstname", "first"],
	lastName: ["prospect_last_name", "last name", "lastname", "last", "surname"],
	fullName: [
		"prospect_full_name",
		"full name",
		"name",
		"contact name",
		"contact",
	],
	email: ["email", "e-mail", "email address", "work email"],
	phone: ["phone", "mobile", "direct phone", "contact phone", "phone number"],
	title: ["prospect_job_title", "title", "job title", "position", "role"],
	linkedin: [
		"prospect_linkedin",
		"linkedin",
		"linkedin url",
		"linkedin profile",
	],
};

function autoMap(headers: string[]): Partial<Record<Target, string>> {
	const lower = headers.map((h) => h.toLowerCase().trim());
	const map: Partial<Record<Target, string>> = {};
	for (const target of TARGETS) {
		for (const alias of AUTO[target.key]) {
			const i = lower.indexOf(alias);
			const header = i >= 0 ? headers[i] : undefined;
			if (header && !Object.values(map).includes(header)) {
				map[target.key] = header;
				break;
			}
		}
	}
	return map;
}

function stripCredentials(name: string): string {
	return (name.split(",")[0] ?? "")
		.replace(/\(.*?\)/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function splitName(full: string): { first: string; last: string } {
	const parts = stripCredentials(full).split(" ").filter(Boolean);
	const first = parts[0] ?? "";
	if (parts.length <= 1) return { first, last: "" };
	return { first, last: parts.slice(1).join(" ") };
}

function normalizeDomain(raw: string): string {
	const v = raw.trim().toLowerCase();
	if (!v) return "";
	try {
		const url = v.includes("://") ? new URL(v) : new URL(`https://${v}`);
		return url.hostname.replace(/^www\./, "");
	} catch {
		return (
			v
				.replace(/^https?:\/\//, "")
				.replace(/^www\./, "")
				.split("/")[0] ?? ""
		);
	}
}

function normalizeLinkedin(raw: string): string {
	const v = raw.trim();
	if (!v) return "";
	if (v.startsWith("http")) return v;
	return `https://www.${v.replace(/^www\./, "")}`;
}

function domainFromEmail(email: string): string {
	const at = email.indexOf("@");
	return at > 0 ? email.slice(at + 1).toLowerCase() : "";
}

type Summary = {
	projectsCreated: number;
	projectsUpdated: number;
	companiesCreated: number;
	companiesMatched: number;
	contactsCreated: number;
	contactsSkipped: number;
	errors: string[];
};

function emptySummary(): Summary {
	return {
		projectsCreated: 0,
		projectsUpdated: 0,
		companiesCreated: 0,
		companiesMatched: 0,
		contactsCreated: 0,
		contactsSkipped: 0,
		errors: [],
	};
}

export function ImportForm() {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const queryClient = useQueryClient();

	const fileId = useId();
	const sourceId = useId();

	const [table, setTable] = useState<CsvTable | null>(null);
	const [ccProjects, setCcProjects] = useState<CcProject[] | null>(null);
	const [fileName, setFileName] = useState("");
	const [mapping, setMapping] = useState<Partial<Record<Target, string>>>({});
	const [source, setSource] = useState("");
	const [progress, setProgress] = useState<{
		done: number;
		total: number;
	} | null>(null);
	const [summary, setSummary] = useState<Summary | null>(null);

	const createCompany = useMutation(trpc.companies.create.mutationOptions());
	const updateCompany = useMutation(trpc.companies.update.mutationOptions());
	const createContact = useMutation(trpc.contacts.create.mutationOptions());
	const updateContact = useMutation(trpc.contacts.update.mutationOptions());
	const createField = useMutation(trpc.fields.create.mutationOptions());
	const upsertProject = useMutation(trpc.projects.upsert.mutationOptions());

	const running = progress !== null && summary === null;

	const ready = useMemo(() => {
		if (!table || table.rows.length === 0) return false;
		if (!source.trim()) return false;
		if (ccProjects) return ccProjects.length > 0;
		const hasPerson = mapping.firstName || mapping.fullName;
		const hasCompany = mapping.companyName || mapping.companyDomain;
		return Boolean(hasPerson || hasCompany);
	}, [table, source, mapping, ccProjects]);

	async function onFile(file: File | null) {
		setSummary(null);
		setProgress(null);
		if (!file) {
			setTable(null);
			setFileName("");
			return;
		}
		const text = await file.text();
		const parsed = toTable(parseCsv(text));
		setTable(parsed);
		setFileName(file.name);
		if (isConstructConnectExport(parsed.headers)) {
			setCcProjects(parseConstructConnect(parsed.rows));
			setMapping({});
		} else {
			setCcProjects(null);
			setMapping(autoMap(parsed.headers));
		}
		if (!source) {
			setSource(file.name.replace(/\.csv$/i, ""));
		}
	}

	function col(row: Record<string, string>, target: Target): string {
		const header = mapping[target];
		return header ? (row[header] ?? "").trim() : "";
	}

	async function ensureSourceField(entity: "COMPANY" | "CONTACT") {
		const list = await queryClient.fetchQuery(
			trpc.fields.list.queryOptions({ entity, includeArchived: false }),
		);
		if (list.some((f) => f.key === SOURCE_FIELD_KEY)) return;
		await createField.mutateAsync({
			entity,
			label: SOURCE_FIELD_LABEL,
			type: "TEXT",
			options: [],
			agentFilled: false,
			agentBrief: null,
			required: false,
			showOnSheet: true,
			showOnTable: false,
			showOnFilter: true,
		});
	}

	async function findCompanyByDomain(domain: string): Promise<string | null> {
		const options = await queryClient.fetchQuery(
			trpc.companies.options.queryOptions({ q: domain }),
		);
		const hit = options.find((c) => (c.domain ?? "").toLowerCase() === domain);
		return hit?.id ?? null;
	}

	async function findCompanyByName(name: string): Promise<string | null> {
		const options = await queryClient.fetchQuery(
			trpc.companies.options.queryOptions({ q: name }),
		);
		const hit = options.find(
			(c) => c.name.toLowerCase() === name.toLowerCase(),
		);
		return hit?.id ?? null;
	}

	function rowDomain(row: Record<string, string>): string {
		const email = col(row, "email").toLowerCase();
		const explicit = normalizeDomain(col(row, "companyDomain"));
		if (explicit) return explicit;
		if (!email) return "";
		const fromEmail = domainFromEmail(email);
		return /(gmail|yahoo|hotmail|outlook|icloud|aol)\./.test(fromEmail)
			? ""
			: fromEmail;
	}

	async function enrichCompany(
		row: Record<string, string>,
		companyId: string,
		tag: string,
	) {
		const data: Record<string, string | Record<string, string>> = {
			fields: { [SOURCE_FIELD_KEY]: tag },
		};
		const phone = col(row, "companyPhone");
		const city = col(row, "companyCity");
		const state = col(row, "companyState");
		const li = normalizeLinkedin(col(row, "companyLinkedin"));
		if (phone) data.phone = phone;
		if (city) data.city = city;
		if (state) data.stateCode = state;
		if (li) data.linkedinUrl = li;
		await updateCompany.mutateAsync({ id: companyId, data });
	}

	async function resolveCompany(
		row: Record<string, string>,
		companyIds: Map<string, string>,
		result: Summary,
		tag: string,
	): Promise<string | null> {
		const domain = rowDomain(row);
		const companyName = col(row, "companyName") || domain;
		if (!companyName) return null;

		const key = domain || companyName.toLowerCase();
		const cached = companyIds.get(key);
		if (cached) return cached;

		let companyId = domain
			? await findCompanyByDomain(domain)
			: await findCompanyByName(companyName);

		if (companyId) {
			result.companiesMatched++;
		} else {
			try {
				const created = await createCompany.mutateAsync({
					name: companyName,
					domain: domain || undefined,
				});
				companyId = created.id;
				result.companiesCreated++;
			} catch (error) {
				companyId = domain ? await findCompanyByDomain(domain) : null;
				if (!companyId) throw error;
				result.companiesMatched++;
			}
		}

		companyIds.set(key, companyId);
		await enrichCompany(row, companyId, tag);
		return companyId;
	}

	function rowName(row: Record<string, string>): {
		first: string;
		last: string;
	} {
		const first = stripCredentials(col(row, "firstName"));
		const last = stripCredentials(col(row, "lastName"));
		if (first) return { first, last };
		const split = splitName(col(row, "fullName"));
		return { first: split.first, last: last || split.last };
	}

	async function importContact(
		row: Record<string, string>,
		companyId: string | null,
		result: Summary,
		tag: string,
	): Promise<void> {
		const { first, last } = rowName(row);
		if (!first) return;

		const email = col(row, "email").toLowerCase();
		let contactId: string;
		try {
			const created = await createContact.mutateAsync({
				firstName: first,
				lastName: last || undefined,
				email: email || undefined,
				phone: col(row, "phone") || undefined,
				title: col(row, "title") || undefined,
				companyId,
			});
			contactId = created.id;
			result.contactsCreated++;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (/already uses/i.test(message)) {
				result.contactsSkipped++;
				return;
			}
			throw error;
		}

		const linkedin = normalizeLinkedin(col(row, "linkedin"));
		await updateContact.mutateAsync({
			id: contactId,
			data: {
				...(linkedin ? { linkedinUrl: linkedin } : {}),
				fields: { [SOURCE_FIELD_KEY]: tag },
			},
		});
	}

	async function run() {
		if (!table) return;
		const tag = source.trim();
		const result = emptySummary();
		setSummary(null);
		setProgress({
			done: 0,
			total: ccProjects ? ccProjects.length : table.rows.length,
		});

		try {
			await ensureSourceField("COMPANY");
			await ensureSourceField("CONTACT");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Could not prepare the Import Source field.",
			);
			setProgress(null);
			return;
		}

		const companyIds = new Map<string, string>();

		if (ccProjects) {
			for (const [index, project] of ccProjects.entries()) {
				try {
					await importProject(project, companyIds, result, tag);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					result.errors.push(`${project.name}: ${message}`);
				}
				setProgress({ done: index + 1, total: ccProjects.length });
			}
		} else {
			for (const [index, row] of table.rows.entries()) {
				try {
					const companyId = await resolveCompany(row, companyIds, result, tag);
					await importContact(row, companyId, result, tag);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					result.errors.push(`Row ${index + 2}: ${message}`);
				}
				setProgress({ done: index + 1, total: table.rows.length });
			}
		}

		await cache.fields();
		await queryClient.invalidateQueries({
			queryKey: trpc.projects.list.queryKey(),
		});
		setSummary(result);
		toast.success(
			ccProjects
				? `Imported ${result.projectsCreated + result.projectsUpdated} projects, ${result.companiesCreated} companies, ${result.contactsCreated} contacts.`
				: `Imported ${result.contactsCreated} contacts and ${result.companiesCreated} companies.`,
		);
	}

	async function teamCompany(
		member: CcTeamMember,
		companyIds: Map<string, string>,
		result: Summary,
		tag: string,
	): Promise<string> {
		const key = member.domain || member.companyName.toLowerCase();
		const cached = companyIds.get(key);
		if (cached) return cached;

		let companyId = member.domain
			? await findCompanyByDomain(member.domain)
			: await findCompanyByName(member.companyName);

		if (companyId) {
			result.companiesMatched++;
		} else {
			try {
				const created = await createCompany.mutateAsync({
					name: member.companyName,
					domain: member.domain || undefined,
				});
				companyId = created.id;
				result.companiesCreated++;
			} catch (error) {
				companyId = member.domain
					? await findCompanyByDomain(member.domain)
					: null;
				if (!companyId) throw error;
				result.companiesMatched++;
			}
		}
		companyIds.set(key, companyId);

		const data: Record<string, string | Record<string, string>> = {
			fields: { [SOURCE_FIELD_KEY]: tag },
		};
		if (member.phone) data.phone = member.phone;
		if (member.city) data.city = member.city;
		if (member.stateCode) data.stateCode = member.stateCode;
		if (member.role) data.industry = member.role;
		await updateCompany.mutateAsync({ id: companyId, data });
		return companyId;
	}

	async function teamContact(
		member: CcTeamMember,
		companyId: string,
		result: Summary,
		tag: string,
	) {
		if (!member.firstName) return;
		let contactId: string;
		try {
			const created = await createContact.mutateAsync({
				firstName: member.firstName,
				lastName: member.lastName || undefined,
				email: member.email || undefined,
				companyId,
			});
			contactId = created.id;
			result.contactsCreated++;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (/already uses/i.test(message)) {
				result.contactsSkipped++;
				return;
			}
			throw error;
		}
		await updateContact.mutateAsync({
			id: contactId,
			data: { fields: { [SOURCE_FIELD_KEY]: tag } },
		});
	}

	async function importProject(
		project: CcProject,
		companyIds: Map<string, string>,
		result: Summary,
		tag: string,
	) {
		let architectId: string | null = null;
		let gcId: string | null = null;
		let developerId: string | null = null;

		for (const member of project.team) {
			const companyId = await teamCompany(member, companyIds, result, tag);
			await teamContact(member, companyId, result, tag);
			const kind = roleKind(member.role);
			if (kind === "architect" && !architectId) architectId = companyId;
			if (kind === "gc" && !gcId) gcId = companyId;
			if (kind === "developer" && !developerId) developerId = companyId;
		}

		const saved = await upsertProject.mutateAsync({
			externalId: project.externalId,
			name: project.name,
			source: "IMPORT",
			address: project.address || null,
			city: project.city || null,
			stateCode: project.stateCode || null,
			county: project.county || null,
			category: project.category || null,
			stage: project.stage,
			value: project.value,
			floors: project.floors,
			floorArea: project.floorArea,
			bidDate: project.bidDate,
			lastUpdateAt: project.lastUpdateAt,
			lastUpdateReason: `Imported: ${tag}`,
			architectId,
			gcId,
			developerId,
		});
		if (saved.created) result.projectsCreated++;
		else result.projectsUpdated++;
	}

	return (
		<div className="max-w-2xl space-y-8">
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor={fileId}>CSV file</FieldLabel>
					<Input
						id={fileId}
						type="file"
						accept=".csv,text/csv"
						disabled={running}
						onChange={(event) => onFile(event.target.files?.[0] ?? null)}
					/>
					<FieldDescription>
						{table && ccProjects
							? `${fileName}: ConstructConnect Design Team export — ${ccProjects.length} projects, ${table.rows.length} team rows. Each project lands with its address, stage, value, floors, and bid date; the architect, GC and developer are linked as companies; every named contact is created.`
							: table
								? `${fileName}: ${table.rows.length} rows, ${table.headers.length} columns.`
								: "Vibe Prospecting exports, HubSpot exports, hand-built sheets, and ConstructConnect Design Team exports (save the .xls as CSV first) all work. Headers are matched automatically; adjust below."}
					</FieldDescription>
				</Field>

				<Field>
					<FieldLabel htmlFor={sourceId}>Import source</FieldLabel>
					<Input
						id={sourceId}
						value={source}
						disabled={running}
						onChange={(event) => setSource(event.target.value)}
						placeholder="ConstructConnect VA/MD/DC Sept 2026"
						maxLength={120}
					/>
					<FieldDescription>
						Written to the <code>{SOURCE_FIELD_LABEL}</code> field on every
						company and contact this run creates or matches. Filter on it later
						to find the batch.
					</FieldDescription>
				</Field>
			</FieldGroup>

			{table && !ccProjects && (
				<div className="space-y-3">
					<h3 className="font-medium text-sm">Column mapping</h3>
					<div className="grid gap-3 sm:grid-cols-2">
						{TARGETS.map((target) => (
							<Field key={target.key}>
								<FieldLabel>{target.label}</FieldLabel>
								<Select
									value={mapping[target.key] ?? NONE}
									disabled={running}
									onValueChange={(value) =>
										setMapping((prev) => ({
											...prev,
											[target.key]: value === NONE ? undefined : value,
										}))
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Not mapped" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={NONE}>Not mapped</SelectItem>
										{table.headers.map((header) => (
											<SelectItem key={header} value={header}>
												{header}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{target.hint && (
									<FieldDescription>{target.hint}</FieldDescription>
								)}
							</Field>
						))}
					</div>
				</div>
			)}

			<div className="flex items-center gap-3">
				<Button onClick={run} disabled={!ready || running}>
					{running && <Spinner data-icon="inline-start" />}
					{running
						? `Importing ${progress?.done ?? 0} / ${progress?.total ?? 0}`
						: "Import"}
				</Button>
				{!source.trim() && table && (
					<span className="text-muted-foreground text-sm">
						Give the batch a source name first.
					</span>
				)}
			</div>

			{summary && (
				<div className="space-y-2 rounded-md border p-4 text-sm">
					{summary.projectsCreated + summary.projectsUpdated > 0 ? (
						<p>
							Projects: {summary.projectsCreated} created,{" "}
							{summary.projectsUpdated} updated (matched by ConstructConnect
							ID).
						</p>
					) : null}
					<p>
						Companies: {summary.companiesCreated} created,{" "}
						{summary.companiesMatched} matched existing.
					</p>
					<p>
						Contacts: {summary.contactsCreated} created,{" "}
						{summary.contactsSkipped} skipped (email already in the CRM).
					</p>
					{summary.errors.length > 0 && (
						<details>
							<summary className="cursor-pointer">
								{summary.errors.length} row
								{summary.errors.length === 1 ? "" : "s"} failed
							</summary>
							<ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
								{summary.errors.map((e) => (
									<li key={e}>{e}</li>
								))}
							</ul>
						</details>
					)}
				</div>
			)}
		</div>
	);
}
