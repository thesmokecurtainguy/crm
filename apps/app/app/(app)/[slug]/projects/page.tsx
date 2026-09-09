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
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { projectsSearchParams } from "./projects-search-params";
import { ProjectsTable } from "./projects-table";

export const metadata: Metadata = {
	title: "Projects",
};

export default function ProjectsPage({
	searchParams,
}: PageProps<"/[slug]/projects">) {
	return (
		<PageShell className="min-h-0">
			<PageShellHeader>
				<PageShellHeading>
					<PageShellTitle>Projects</PageShellTitle>
					<PageShellDescription>
						Buildings in design, the leads waiting to be qualified, and
						everything that has already closed.
					</PageShellDescription>
				</PageShellHeading>
			</PageShellHeader>

			<PageShellContent className="min-h-0">
				<Suspense fallback={<PageShellLoading />}>
					<Projects searchParams={searchParams} />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Projects({
	searchParams,
}: Pick<PageProps<"/[slug]/projects">, "searchParams">) {
	const [, values] = await Promise.all([
		requireSession(),
		projectsSearchParams.load(searchParams),
	]);

	const trpc = getServerTrpc();
	const queryClient = getServerQueryClient();
	await Promise.all([
		queryClient.prefetchQuery(
			trpc.projects.list.queryOptions(projectsSearchParams.toInput(values)),
		),
		queryClient.prefetchQuery(trpc.users.list.queryOptions()),
	]);

	return (
		<HydrateClient>
			<ProjectsTable />
		</HydrateClient>
	);
}
