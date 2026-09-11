import type { Metadata } from "next";
import { Suspense } from "react";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { WeekView } from "./week-view";

export const metadata: Metadata = {
	title: "Calendar",
};

export default function CalendarPage() {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Calendar</PageShellTitle>
					<PageShellDescription>
						Every calendar on your account in one week. The agent's blocks are
						marked; click an event to open the record it's about, or open it in
						Google to move it.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>
			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Gate />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Gate() {
	await requireSession();
	return <WeekView />;
}
