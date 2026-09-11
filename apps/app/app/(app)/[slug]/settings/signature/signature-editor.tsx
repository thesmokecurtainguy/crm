"use client";

import { Button } from "@crm/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { Textarea } from "@crm/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

export function SignatureEditor() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const signature = useQuery(trpc.templates.signature.queryOptions());
	const [full, setFull] = useState("");
	const [short, setShort] = useState("");
	const [logoUrl, setLogoUrl] = useState("");

	useEffect(() => {
		if (!signature.data) return;
		setFull(signature.data.full);
		setShort(signature.data.short);
		setLogoUrl(signature.data.logoUrl ?? "");
	}, [signature.data]);

	const save = useMutation(
		trpc.templates.setSignature.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.templates.signature.queryKey(),
				});
				toast.success("Signature saved.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<div className="max-w-2xl">
			<FieldGroup>
				<Field>
					<FieldLabel>Full signature (new emails)</FieldLabel>
					<Textarea
						rows={8}
						value={full}
						onChange={(e) => setFull(e.target.value)}
						placeholder={
							"John McPhail\nStöbich North America\n(704) 555-0100\nthesmokecurtainguy.com"
						}
						className="font-sans"
					/>
				</Field>
				<Field>
					<FieldLabel>Short signature (replies)</FieldLabel>
					<Textarea
						rows={4}
						value={short}
						onChange={(e) => setShort(e.target.value)}
						placeholder={"John\n(704) 555-0100"}
						className="font-sans"
					/>
				</Field>
				<Field>
					<FieldLabel>Logo image URL</FieldLabel>
					<Input
						value={logoUrl}
						onChange={(e) => setLogoUrl(e.target.value)}
						placeholder="https://crm.johnmcphail.net/tscg-logo.jpg"
					/>
					<FieldDescription>
						A PNG or JPG on the web. It goes under the signature in the HTML
						version of the email; a checkbox in the composer turns it off per
						email. Your TSCG logo is already hosted at the address shown.
					</FieldDescription>
				</Field>
				<div>
					<Button
						disabled={save.isPending}
						onClick={() =>
							save.mutate({
								full,
								short,
								logoUrl: logoUrl.trim() || null,
							})
						}
					>
						{save.isPending ? <Spinner data-icon="inline-start" /> : null}
						Save
					</Button>
				</div>
			</FieldGroup>
		</div>
	);
}
