import { Suspense } from "react";
import {
	PageShell,
	PageShellActions,
	PageShellContent,
	PageShellHeader,
	PageShellHeading,
	PageShellLoading,
} from "@/components/page-shell";
import { requireSession } from "@/lib/session";
import { HydrateClient } from "@/lib/trpc/hydrate";
import { getServerQueryClient, getServerTrpc } from "@/lib/trpc/server";
import { HomeTabs, HomeTabsFallback } from "./home-tabs";
import {
	OverviewGreeting,
	OverviewGreetingFallback,
} from "./overview-greeting";
import { TodayView } from "./today-view";

export default function TodayPage({ params }: PageProps<"/[slug]">) {
	return (
		<PageShell>
			<PageShellHeader>
				<PageShellHeading>
					<Suspense fallback={<OverviewGreetingFallback />}>
						<OverviewGreeting />
					</Suspense>
				</PageShellHeading>
				<PageShellActions>
					<Suspense fallback={<HomeTabsFallback active="today" />}>
						<HomeTabs active="today" params={params} />
					</Suspense>
				</PageShellActions>
			</PageShellHeader>

			<PageShellContent>
				<Suspense fallback={<PageShellLoading />}>
					<Today />
				</Suspense>
			</PageShellContent>
		</PageShell>
	);
}

async function Today() {
	await requireSession();
	const queryClient = getServerQueryClient();
	await queryClient.prefetchQuery(getServerTrpc().brief.today.queryOptions());
	return (
		<HydrateClient>
			<TodayView />
		</HydrateClient>
	);
}
