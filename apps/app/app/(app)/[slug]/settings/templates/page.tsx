import type { Metadata } from "next";
import {
	PageShell,
	PageShellContent,
	PageShellDescription,
	PageShellHeader,
	PageShellHeading,
	PageShellTitle,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { TemplatesEditor } from "./templates-editor";

export const metadata: Metadata = {
	title: "Templates",
};

export default async function TemplatesSettingsPage() {
	await requireSession();

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
				<TemplatesEditor />
			</PageShellContent>
		</PageShell>
	);
}
