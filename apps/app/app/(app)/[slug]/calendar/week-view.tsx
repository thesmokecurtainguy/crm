"use client";

import ChevronLeft from "@carbon/icons-react/es/ChevronLeft";
import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import Launch from "@carbon/icons-react/es/Launch";
import { Button } from "@crm/ui/components/button";
import { Spinner } from "@crm/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useOpenRecord } from "@/components/crm/record-sheet/record-stack";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Week = RouterOutputs["calendar"]["week"];
type Event = Week["events"][number];

const DAY = 24 * 60 * 60 * 1000;

function startOfWeek(d: Date): Date {
	const day = new Date(d);
	day.setHours(0, 0, 0, 0);
	const offset = (day.getDay() + 6) % 7;
	return new Date(day.getTime() - offset * DAY);
}

function sameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

function timeOf(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(iso));
}

function tone(event: Event, calendars: Week["calendars"]): string {
	const calendar = calendars.find((c) => c.id === event.calendarId);
	if (calendar?.agent) return "border-l-primary bg-primary/10";
	if (calendar?.primary) return "border-l-foreground/60 bg-accent";
	return "border-l-info bg-info/10";
}

export function WeekView() {
	const trpc = useTRPC();
	const openRecord = useOpenRecord();
	const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

	const week = useQuery({
		...trpc.calendar.week.queryOptions({ start: weekStart.toISOString() }),
		placeholderData: (previous) => previous,
	});

	const days = useMemo(
		() =>
			Array.from(
				{ length: 7 },
				(_, i) => new Date(weekStart.getTime() + i * DAY),
			),
		[weekStart],
	);
	const today = new Date();

	const label = new Intl.DateTimeFormat("en-US", {
		month: "long",
		day: "numeric",
	});
	const heading = `${label.format(days[0] ?? weekStart)} – ${label.format(days[6] ?? weekStart)}`;

	return (
		<div className="flex min-h-0 flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<Button
					variant="outline"
					size="icon-sm"
					aria-label="Previous week"
					onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * DAY))}
				>
					<ChevronLeft />
				</Button>
				<Button
					variant="outline"
					size="icon-sm"
					aria-label="Next week"
					onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * DAY))}
				>
					<ChevronRight />
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setWeekStart(startOfWeek(new Date()))}
				>
					This week
				</Button>
				<span className="font-medium">{heading}</span>
				{week.isFetching ? <Spinner className="size-4" /> : null}
				<span className="ml-auto flex flex-wrap gap-3 text-muted-foreground text-xs">
					{(week.data?.calendars ?? []).map((c) => (
						<span key={c.id} className="inline-flex items-center gap-1.5">
							<span
								className={`inline-block size-2.5 rounded-sm ${
									c.agent
										? "bg-primary"
										: c.primary
											? "bg-foreground/60"
											: "bg-info"
								}`}
							/>
							{c.name}
						</span>
					))}
				</span>
			</div>

			<div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto md:grid-cols-7">
				{days.map((day) => {
					const events = (week.data?.events ?? []).filter((e) =>
						sameDay(new Date(e.start), day),
					);
					const isToday = sameDay(day, today);
					return (
						<div
							key={day.toISOString()}
							className={`flex min-h-[160px] flex-col rounded-md border ${
								isToday ? "border-primary" : ""
							}`}
						>
							<div className="border-b px-2 py-1.5 text-xs">
								<span className="font-medium">
									{new Intl.DateTimeFormat("en-US", {
										weekday: "short",
									}).format(day)}
								</span>{" "}
								<span className="text-muted-foreground">{day.getDate()}</span>
							</div>
							<ul className="flex flex-col gap-1 p-1.5">
								{events.length === 0 ? (
									<li className="px-1 py-2 text-muted-foreground text-xs">—</li>
								) : null}
								{events.map((e) => (
									<li
										key={`${e.calendarId}-${e.id}`}
										className={`rounded border-l-2 px-2 py-1 text-xs ${tone(e, week.data?.calendars ?? [])}`}
									>
										<div className="flex items-start justify-between gap-1">
											{e.record ? (
												<button
													type="button"
													className="text-left font-medium hover:underline"
													onClick={() =>
														openRecord({
															kind: e.record?.kind ?? "contact",
															id: e.record?.id ?? "",
														})
													}
												>
													{e.title}
												</button>
											) : (
												<span className="font-medium">{e.title}</span>
											)}
											{e.url ? (
												<a
													href={e.url}
													target="_blank"
													rel="noreferrer"
													aria-label="Open in Google Calendar"
													className="shrink-0 text-muted-foreground hover:text-foreground"
												>
													<Launch className="size-3" />
												</a>
											) : null}
										</div>
										<div className="text-muted-foreground">
											{e.allDay
												? "All day"
												: `${timeOf(e.start)}–${timeOf(e.end)}`}
											{e.record ? ` · ${e.record.name}` : ""}
										</div>
									</li>
								))}
							</ul>
						</div>
					);
				})}
			</div>
		</div>
	);
}
