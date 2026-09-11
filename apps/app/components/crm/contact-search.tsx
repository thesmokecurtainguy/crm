"use client";

import { Button } from "@crm/ui/components/button";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@crm/ui/components/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@crm/ui/components/popover";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";

export type PickedContact = {
	id: string;
	name: string;
	title: string | null;
	companyName: string | null;
};

export function ContactSearch({
	onPick,
	placeholder = "Search people…",
	label = "Add person",
	companyId,
}: {
	onPick: (contact: PickedContact) => void;
	placeholder?: string;
	label?: string;
	companyId?: string;
}) {
	const trpc = useTRPC();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	const contacts = useQuery({
		...trpc.contacts.list.queryOptions({
			q: query,
			pageSize: 8,
			...(companyId ? { company: [companyId] } : {}),
		}),
		enabled: open,
		placeholderData: (previous) => previous,
	});

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button size="sm" variant="outline">
					{label}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[360px] p-0" align="start">
				<Command shouldFilter={false}>
					<CommandInput
						placeholder={placeholder}
						value={query}
						onValueChange={setQuery}
						autoFocus
					/>
					<CommandList>
						<CommandEmpty>
							{contacts.isFetching ? "Searching…" : "No one matches."}
						</CommandEmpty>
						{(contacts.data?.rows ?? []).map((row) => {
							const name = [row.firstName, row.lastName]
								.filter(Boolean)
								.join(" ");
							return (
								<CommandItem
									key={row.id}
									value={row.id}
									onSelect={() => {
										onPick({
											id: row.id,
											name,
											title: row.title ?? null,
											companyName: row.company?.name ?? null,
										});
										setOpen(false);
										setQuery("");
									}}
								>
									<span className="flex min-w-0 flex-col">
										<span className="truncate">{name}</span>
										<span className="truncate text-muted-foreground text-xs">
											{[row.title, row.company?.name]
												.filter(Boolean)
												.join(" · ")}
										</span>
									</span>
								</CommandItem>
							);
						})}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
