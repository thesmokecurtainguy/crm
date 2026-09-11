import { z } from "zod";

export const calendarWeekInput = z.object({
	start: z.string(),
});

export const calendarWeekOutput = z.object({
	start: z.string(),
	end: z.string(),
	calendars: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			primary: z.boolean(),
			agent: z.boolean(),
		}),
	),
	events: z.array(
		z.object({
			id: z.string(),
			calendarId: z.string(),
			calendarName: z.string(),
			title: z.string(),
			start: z.string(),
			end: z.string(),
			allDay: z.boolean(),
			location: z.string().nullable(),
			url: z.string().nullable(),
			record: z
				.object({
					kind: z.enum(["contact", "company"]),
					id: z.string(),
					name: z.string(),
				})
				.nullable(),
		}),
	),
});
