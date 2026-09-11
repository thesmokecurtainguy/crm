import { Button } from "@crm/ui/components/button";
import Link from "next/link";
import { workspaceUrl } from "@/lib/workspace-url";

export function HomeTabsFallback({ active }: { active: "today" | "overview" }) {
	return (
		<div className="flex items-center gap-1">
			<Button
				disabled
				size="sm"
				variant={active === "today" ? "contrast" : "ghost"}
			>
				Today
			</Button>
			<Button
				disabled
				size="sm"
				variant={active === "overview" ? "contrast" : "ghost"}
			>
				Overview
			</Button>
		</div>
	);
}

export async function HomeTabs({
	active,
	params,
}: {
	active: "today" | "overview";
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	return (
		<div className="flex items-center gap-1">
			<Button
				asChild
				size="sm"
				variant={active === "today" ? "contrast" : "ghost"}
			>
				<Link href={workspaceUrl(slug, "/")}>Today</Link>
			</Button>
			<Button
				asChild
				size="sm"
				variant={active === "overview" ? "contrast" : "ghost"}
			>
				<Link href={workspaceUrl(slug, "/overview")}>Overview</Link>
			</Button>
		</div>
	);
}
