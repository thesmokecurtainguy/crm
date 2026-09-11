"use client";

import { Button } from "@crm/ui/components/button";
import Link from "next/link";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";

export function HomeTabs({ active }: { active: "today" | "overview" }) {
	const workspaceUrl = useWorkspaceUrl();
	return (
		<div className="flex items-center gap-1">
			<Button
				asChild
				size="sm"
				variant={active === "today" ? "contrast" : "ghost"}
			>
				<Link href={workspaceUrl("/")}>Today</Link>
			</Button>
			<Button
				asChild
				size="sm"
				variant={active === "overview" ? "contrast" : "ghost"}
			>
				<Link href={workspaceUrl("/overview")}>Overview</Link>
			</Button>
		</div>
	);
}
