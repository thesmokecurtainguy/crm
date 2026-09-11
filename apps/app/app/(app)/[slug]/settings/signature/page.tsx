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
import { SignatureEditor } from "./signature-editor";

export const metadata: Metadata = {
	title: "Signature",
};

export default async function SignatureSettingsPage() {
	await requireSession();

	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Email signature</PageShellTitle>
					<PageShellDescription>
						Added to every email you write in the CRM. The full version goes on
						new emails, the short one on replies; you can edit either before
						sending.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<SignatureEditor />
			</PageShellContent>
		</PageShell>
	);
}
