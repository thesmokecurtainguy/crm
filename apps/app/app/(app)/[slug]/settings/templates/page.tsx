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
import { TemplatesEditor } from "./templates-editor";

export const metadata: Metadata = {
	title: "Templates",
};

export default function TemplatesSettingsPage() {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Email templates</PageShellTitle>
					<PageShellDescription>
						Your wording, filled in from the record you're on. Placeholders in
						double braces; wrap optional pieces in a section so they vanish when
						the record has nothing.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Templates />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Templates() {
	await requireSession();

	return <TemplatesEditor />;
}
