import type { Db } from "@crm/db";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import { MailboxApiClient } from "../mailbox/mailbox-api.client";
import { MailboxTokenService } from "../mailbox/mailbox-token.service";

const CALENDAR = "https://www.googleapis.com/calendar/v3";
const SETTINGS_ID = "app";
const DAY = 24 * 60 * 60 * 1000;

type GoogleCalendar = {
	id: string;
	summary?: string;
	primary?: boolean;
	accessRole?: string;
	selected?: boolean;
};

type GoogleEvent = {
	id: string;
	summary?: string;
	status?: string;
	htmlLink?: string;
	location?: string;
	start?: { dateTime?: string; date?: string };
	end?: { dateTime?: string; date?: string };
};

@Injectable()
export class CalendarService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly tokens: MailboxTokenService,
		private readonly api: MailboxApiClient,
	) {}

	async week(userId: string, startIso: string) {
		const start = new Date(startIso);
		if (Number.isNaN(start.getTime()))
			throw new BadRequestException("Bad start date.");
		const end = new Date(start.getTime() + 7 * DAY);

		const token = await this.tokens.accessTokenFor(userId, "gmail");
		if (token.outcome !== "ok") throw new ForbiddenException(token.reason);

		const [listed, settings] = await Promise.all([
			this.api.get<{ items?: GoogleCalendar[] }>(
				`${CALENDAR}/users/me/calendarList`,
				token.accessToken,
				{ minAccessRole: "reader" },
			),
			this.db.appSetting.findUnique({
				where: { id: SETTINGS_ID },
				select: { agentCalendarId: true },
			}),
		]);
		if (listed.outcome !== "ok")
			throw new BadRequestException(`Calendar list failed: ${listed.reason}.`);

		const calendars = (listed.data.items ?? [])
			.filter((c) => c.selected !== false)
			.map((c) => ({
				id: c.id,
				name: c.summary ?? c.id,
				primary: Boolean(c.primary),
				agent: c.id === settings?.agentCalendarId,
			}));

		const perCalendar = await Promise.all(
			calendars.map(async (calendar) => {
				const result = await this.api.get<{ items?: GoogleEvent[] }>(
					`${CALENDAR}/calendars/${encodeURIComponent(calendar.id)}/events`,
					token.accessToken,
					{
						timeMin: start.toISOString(),
						timeMax: end.toISOString(),
						singleEvents: "true",
						orderBy: "startTime",
						maxResults: 250,
					},
				);
				if (result.outcome !== "ok") return [];
				return (result.data.items ?? [])
					.filter((e) => e.status !== "cancelled")
					.map((e) => ({
						id: e.id,
						calendarId: calendar.id,
						calendarName: calendar.name,
						title: e.summary ?? "(untitled)",
						start: e.start?.dateTime ?? `${e.start?.date}T00:00:00`,
						end: e.end?.dateTime ?? `${e.end?.date}T00:00:00`,
						allDay: Boolean(e.start?.date && !e.start?.dateTime),
						location: e.location ?? null,
						url: e.htmlLink ?? null,
						record: null as {
							kind: "contact" | "company";
							id: string;
							name: string;
						} | null,
					}));
			}),
		);

		const events = perCalendar.flat();
		const ids = events.map((e) => e.id);
		const synced = ids.length
			? await this.db.calendarEvent.findMany({
					where: { googleEventId: { in: ids } },
					select: {
						googleEventId: true,
						contact: { select: { id: true, firstName: true, lastName: true } },
						company: { select: { id: true, name: true } },
					},
				})
			: [];
		const byGoogleId = new Map(synced.map((s) => [s.googleEventId, s]));
		for (const event of events) {
			const match = byGoogleId.get(event.id);
			if (!match) continue;
			if (match.contact) {
				event.record = {
					kind: "contact",
					id: match.contact.id,
					name: [match.contact.firstName, match.contact.lastName]
						.filter(Boolean)
						.join(" "),
				};
			} else if (match.company) {
				event.record = {
					kind: "company",
					id: match.company.id,
					name: match.company.name,
				};
			}
		}

		events.sort((a, b) => a.start.localeCompare(b.start));
		return {
			start: start.toISOString(),
			end: end.toISOString(),
			calendars,
			events,
		};
	}
}
