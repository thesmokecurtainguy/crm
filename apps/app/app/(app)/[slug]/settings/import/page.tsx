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
import { ImportForm } from "./import-form";

export const metadata: Metadata = {
	title: "Import",
};

export default function ImportSettingsPage() {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Import</PageShellTitle>
					<PageShellDescription>
						Load companies and contacts from a CSV. Every imported record is
						tagged with an import source so you can always tell a list from a
						relationship. Duplicates by domain or email are matched, not
						repeated.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Import />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Import() {
	await requireSession();

	return <ImportForm />;
}
