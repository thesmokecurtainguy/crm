import { db } from "@crm/db";
import { websiteUrl } from "@crm/db/workspace";
import { capabilitiesMarkdown } from "./capabilities";
import { identity, usMarkdown, type WorkspaceIdentity } from "./workspace";

export type Opened = {
	dispatched: boolean;
	kind?: string | null;
	reason?: string | null;
	budget?: number | null;
	/** Set only for a `field-backfill` task — the custom field key(s) still blank on this record. */
	fieldKeys?: string[] | null;
};

export type Preamble = {
	markdown: string;
	focus: { contactId?: string | null; companyId?: string | null };
};

export async function sessionPreamble(
	record: {
		contactId?: string | null;
		companyId?: string | null;
		dealId?: string | null;
		projectId?: string | null;
	},
	opened: Opened,
): Promise<Preamble> {
	if (opened.kind === "workspace-profile") return workspacePreamble();
	if (record.contactId) return contactPreamble(record.contactId, opened);
	if (record.companyId) return companyPreamble(record.companyId, opened);
	if (record.dealId) return dealPreamble(record.dealId, opened);
	if (record.projectId) return projectPreamble(record.projectId, opened);
	return noRecordPreamble();
}

export async function composeClosing(
	us: WorkspaceIdentity | null,
): Promise<string> {
	return [usMarkdown(us), await capabilitiesMarkdown()]
		.filter(Boolean)
		.join("\n\n");
}

async function closing(): Promise<string> {
	return composeClosing(await identity());
}

function fieldBackfillLine(opened: Opened): string {
	if (!opened.fieldKeys || opened.fieldKeys.length === 0) return "";

	return [
		`**This is a field-backfill task.** This record is missing a value for`,
		`the custom field key(s) ${opened.fieldKeys.map((key) => `\`${key}\``).join(", ")}.`,
		"Call `list_fields` for this record's entity type to read each field's",
		"label, options and brief (what counts as an answer), then call",
		"`set_field_value` with this record's id for any you find real evidence",
		"for. Leave one blank rather than guess.",
	].join(" ");
}

function opening(opened: Opened, questions: string): string {
	if (opened.dispatched) {
		return [
			"This session was started by the dispatcher, not by a person. Nobody is",
			"waiting on a reply — do the work, record what you find, and stop.",
		].join(" ");
	}

	return [
		"**A rep has this record open and is talking to you.** Answer what they",
		`actually asked — usually some form of ${questions} — from what the CRM`,
		"already holds, and say plainly when we do not know something. Research it",
		"further only if the answer needs it or they ask you to. Never ask them for",
		"an id, a name or an address you can look up yourself.",
	].join(" ");
}

export async function contactPreamble(
	contactId: string,
	opened: Opened,
): Promise<Preamble> {
	const contact = await db.contact.findUnique({
		where: { id: contactId },
		select: {
			firstName: true,
			lastName: true,
			email: true,
			title: true,
			company: { select: { id: true, name: true, domain: true } },
			brief: { select: { refreshedAt: true } },
			deals: {
				orderBy: { deal: { lastActivityAt: "desc" } },
				take: 5,
				select: {
					role: true,
					deal: { select: { id: true, name: true, stage: true } },
				},
			},
			_count: { select: { emailThreads: true, calendarEvents: true } },
		},
	});

	if (!contact) {
		return { markdown: await closing(), focus: { contactId } };
	}

	const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");

	const known =
		contact._count.emailThreads > 0 || contact._count.calendarEvents > 0
			? `We have ${contact._count.emailThreads} thread(s) and ${contact._count.calendarEvents} meeting(s) with them — read those first.`
			: "We have never corresponded with them, so there is nothing internal to go on.";

	const deals = contact.deals
		.map(
			({ role, deal }) =>
				`${deal.name} (${deal.stage}${role ? `, ${role}` : ""}) \`${deal.id}\``,
		)
		.join("; ");

	const markdown = [
		"## This session",
		"",
		`You are working on **${name}** (\`${contactId}\`)${
			contact.email ? `, ${contact.email}` : ""
		}${contact.title ? `, ${contact.title}` : ""}.`,
		opened.kind ? `Task: **${opened.kind}**.` : "",
		opened.reason ? `Why now: ${opened.reason}` : "",
		opened.budget
			? `Budget: **${opened.budget}** vendor calls. Spend them where they matter.`
			: "",
		fieldBackfillLine(opened),
		"",
		opening(
			opened,
			"who this person is, whether they are still there, or what to know before a call",
		),
		"",
		contact.company
			? `They work at **${contact.company.name}**${
					contact.company.domain ? ` (${contact.company.domain})` : ""
				}, company id \`${contact.company.id}\` — pass that straight to \`read_company_history\`, \`enrich_company\` or \`research_company\` when the question reaches past this one person.`
			: "They are not attached to a company. `search_crm` will find one by name or domain if the conversation needs it.",
		deals ? `They are on: ${deals}.` : "They are not on any deal.",
		"",
		known,
		contact.brief
			? `A background already exists, written ${contact.brief.refreshedAt.toDateString()}. Replace it only if you learn something it does not say.`
			: "There is no background on them yet.",
		"",
		"Start with `read_crm_history` on this contact id.",
		"",
		await closing(),
	]
		.filter(Boolean)
		.join("\n");

	return {
		markdown,
		focus: { contactId, companyId: contact.company?.id ?? null },
	};
}

export async function companyPreamble(
	companyId: string,
	opened: Opened,
): Promise<Preamble> {
	const company = await db.company.findUnique({
		where: { id: companyId },
		select: {
			name: true,
			domain: true,
			industry: true,
			description: true,
			contacts: {
				orderBy: [{ lastActivityAt: "desc" }, { createdAt: "asc" }],
				take: 12,
				select: { id: true, firstName: true, lastName: true, title: true },
			},
			deals: {
				orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
				take: 8,
				select: { id: true, name: true, stage: true },
			},
			_count: { select: { contacts: true } },
		},
	});

	if (!company) {
		return { markdown: await closing(), focus: { companyId } };
	}

	const people = company.contacts
		.map((person) => {
			const name = [person.firstName, person.lastName]
				.filter(Boolean)
				.join(" ");
			return `- ${name}${person.title ? ` — ${person.title}` : ""} \`${person.id}\``;
		})
		.join("\n");

	const more =
		company._count.contacts > company.contacts.length
			? `\n- …and ${company._count.contacts - company.contacts.length} more; \`read_company_history\` lists them all.`
			: "";

	const deals = company.deals
		.map((deal) => `${deal.name} (${deal.stage}) \`${deal.id}\``)
		.join("; ");

	const markdown = [
		"## This session",
		"",
		`You are working on **${company.name}**${
			company.domain ? ` (${company.domain})` : ""
		}${company.industry ? `, ${company.industry}` : ""} — company id \`${companyId}\`.`,
		fieldBackfillLine(opened),
		"",
		opening(
			opened,
			"what this company does, who we know there, or what has changed recently",
		),
		"",
		people
			? `### Who we know there (${company._count.contacts})\n\n${people}${more}\n\nThose are contact ids. Use them directly — with \`read_crm_history\`, \`identify_contact\` or \`record_fact\`. Never ask a rep which contact they mean without naming these first.`
			: "We have no contacts on file here yet.",
		"",
		deals ? `Deals: ${deals}.` : "There are no deals here.",
		company.description
			? "There is already a description on the record."
			: "There is no description on the record yet.",
		"",
		"Start with `read_company_history` on this company id — it returns the people, the deals, the correspondence and the notes in one free call.",
		"",
		await closing(),
	]
		.filter(Boolean)
		.join("\n");

	return { markdown, focus: { companyId } };
}

export async function dealPreamble(
	dealId: string,
	opened: Opened,
): Promise<Preamble> {
	const deal = await db.deal.findUnique({
		where: { id: dealId },
		select: {
			name: true,
			description: true,
			stage: true,
			amount: true,
			currency: true,
			expectedCloseDate: true,
			lastActivityAt: true,
			channel: true,
			project: { select: { id: true, name: true } },
			company: { select: { id: true, name: true } },
			contacts: {
				select: {
					role: true,
					contact: {
						select: { id: true, firstName: true, lastName: true, title: true },
					},
				},
			},
		},
	});

	if (!deal) return { markdown: await closing(), focus: {} };

	const people = deal.contacts
		.map(({ role, contact }) => {
			const name = [contact.firstName, contact.lastName]
				.filter(Boolean)
				.join(" ");
			return `${name}${contact.title ? ` (${contact.title})` : ""}${
				role ? ` — ${role}` : ""
			} \`${contact.id}\``;
		})
		.join("; ");

	const markdown = [
		"## This session",
		"",
		`You are working on the deal **${deal.name}**${
			deal.company ? ` at ${deal.company.name}` : ""
		} — deal id \`${dealId}\`${
			deal.company ? `, company id \`${deal.company.id}\`` : ""
		}.`,
		`Stage: **${deal.stage}**${
			deal.amount
				? `. Amount: ${deal.amount} ${deal.currency ?? ""}`.trim()
				: ""
		}${
			deal.expectedCloseDate
				? `. Expected close: ${deal.expectedCloseDate.toDateString()}`
				: ""
		}.`,
		deal.lastActivityAt
			? `Last touched ${deal.lastActivityAt.toDateString()}.`
			: "Nothing has happened on it yet.",
		...(deal.channel
			? [
					`This is a **quote** (${deal.channel === "DIRECT" ? "direct bid" : "through a distributor"})${
						deal.project
							? ` on the project **${deal.project.name}** — project id \`${deal.project.id}\``
							: ""
					}. The bid date is the expected close above; the follow-up clock runs from it. Load quote-cadence before acting on it.`,
				]
			: []),
		...(deal.description
			? [`The rep's own description of it: "${deal.description}"`]
			: []),
		people ? `People on it: ${people}` : "Nobody is attached to it yet.",
		fieldBackfillLine(opened),
		"",
		opening(
			opened,
			"where this stands, who else should be involved, or what the risk is",
		),
		"",
		"Start with `read_deal_history` on this deal id. It returns the stage clock, every stage this deal has moved through, the last reply from their side and the next meeting — which is how you answer *where does this stand* rather than reciting the stage field back.",
		"",
		opened.fieldKeys && opened.fieldKeys.length > 0
			? "You can research the people and the company behind it with the usual tools too — most of what you learn about them is recorded against them, not the deal."
			: "You can research the people and the company behind it with the usual tools — a deal itself has no fields to enrich, so anything you learn is recorded against them.",
		"",
		await closing(),
	]
		.filter(Boolean)
		.join("\n");

	return { markdown, focus: { companyId: deal.company?.id ?? null } };
}

export async function projectPreamble(
	projectId: string,
	opened: Opened,
): Promise<Preamble> {
	const project = await db.project.findUnique({
		where: { id: projectId },
		select: {
			name: true,
			stage: true,
			leadStatus: true,
			city: true,
			stateCode: true,
			value: true,
			floors: true,
			bidDate: true,
			lastUpdateReason: true,
			lastUpdateAt: true,
			architect: { select: { id: true, name: true } },
			gc: { select: { id: true, name: true } },
			developer: { select: { id: true, name: true } },
		},
	});

	if (!project) return { markdown: await closing(), focus: {} };

	const where = [project.city, project.stateCode].filter(Boolean).join(", ");
	const team = [
		project.architect
			? `architect ${project.architect.name} \`${project.architect.id}\``
			: null,
		project.gc ? `GC ${project.gc.name} \`${project.gc.id}\`` : null,
		project.developer
			? `developer ${project.developer.name} \`${project.developer.id}\``
			: null,
	]
		.filter(Boolean)
		.join("; ");

	const markdown = [
		"## This session",
		"",
		`You are working on the project **${project.name}**${where ? ` in ${where}` : ""} — project id \`${projectId}\`.`,
		`Stage: **${project.stage}**, triage: **${project.leadStatus}**${
			project.value
				? `. Value: $${project.value.toNumber().toLocaleString("en-US")}`
				: ""
		}${project.floors ? `. ${project.floors} floors` : ""}${
			project.bidDate ? `. Bid date: ${project.bidDate.toDateString()}` : ""
		}.`,
		project.lastUpdateReason
			? `Last update: ${project.lastUpdateReason}${
					project.lastUpdateAt
						? ` (${project.lastUpdateAt.toDateString()})`
						: ""
				}.`
			: "",
		team ? `Team: ${team}.` : "No team companies linked yet.",
		"",
		opening(
			opened,
			"who to contact about it, what to draft, or where it stands",
		),
		"",
		"Start with `read_project` on this project id. It returns the building, the team firms with their people and contact ids, John's dated log, linked quotes, and anything already drafted or scheduled — so you never draft twice or ask for a name you already have.",
		"",
		"Outreach on a project goes to the project architect first, about this project. Check `participants` in the project read: people John assigned to this project outrank the firm roster. If nobody is named yet, use `read_company_history` on the architect and, if that is thin, `read_website` on the firm's site to find the People page; when you learn who the project architect is, `add_project_participant` with the role so it sticks. Draft with `draft_email` only after loading drafting-for-john. Follow-ups and to-dos go on the CRM calendar with `propose_todo`.",
		"",
		await closing(),
	]
		.filter(Boolean)
		.join("\n");

	return { markdown, focus: { companyId: project.architect?.id ?? null } };
}

export async function noRecordPreamble(): Promise<Preamble> {
	return {
		markdown: [
			"## This session",
			"",
			"No record was named, so nothing is in focus yet. John is talking to you from a list page.",
			"`search_crm` finds any contact, company or deal by name, email address or",
			"domain; look the record up rather than asking for an id. `list_outstanding_work`",
			"shows contacts with research outstanding. To fill missing emails at a firm, find the",
			"company with `search_crm`, then call `fill_company_emails` (dryRun first, then for",
			"real) and report the pattern and the count. For a project, find it and then use",
			"`read_project`.",
			"",
			await closing(),
		].join("\n"),
		focus: {},
	};
}

export async function workspacePreamble(
	known?: WorkspaceIdentity | null,
): Promise<Preamble> {
	const us = known === undefined ? await identity() : known;
	const site = websiteUrl(us?.website);

	if (!us || !site) {
		return {
			markdown: [
				"## This session",
				"",
				"You were asked to write the profile of the company you work for, and",
				"this install has no web address on record — nobody gave one, or what is",
				"stored is not one. There is nothing to read. Stop — do not guess at it",
				"from the email addresses in the CRM.",
			].join("\n"),
			focus: {},
		};
	}

	const markdown = [
		"## This session",
		"",
		`You are writing the profile of **the company you work for** — ${us.name} (${us.website}).`,
		us.profile
			? `One already exists, written ${us.profile.refreshedAt.toDateString()}. Replace it only if the site now says something different.`
			: "There is no profile of us yet.",
		"",
		`Read ${site} with \`web_fetch\` — the home page, and the pricing or product`,
		"page if there is one — and search the web only if the site does not say who",
		"the customer is. Then call `write_workspace_profile`.",
		"",
		"**Every other session opens with what you write here**, in front of the",
		"record a rep is asking about, so it has to be short and it has to be",
		"substance. The tool enforces that: 320 characters of narrative and one",
		"short line each for what we sell, who we sell to, and what we are picked",
		"over. Leave a line out rather than padding it. No marketing adjectives —",
		'"leading", "innovative" and "best-in-class" say nothing a rep can use.',
		"",
		"You are describing us to a colleague who has just joined, not writing our",
		"home page back to us.",
		"",
		await capabilitiesMarkdown(),
	].join("\n");

	return { markdown, focus: {} };
}
