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
import { SkillsEditor } from "./skills-editor";

export const metadata: Metadata = {
	title: "Skills",
};

export default function SkillsSettingsPage() {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Agent skills</PageShellTitle>
					<PageShellDescription>
						The rules the agent works by, in plain English. Edit a skill here
						and the agent uses your version from its next session. Reset puts
						the shipped copy back.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Skills />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Skills() {
	await requireSession();

	return <SkillsEditor />;
}
