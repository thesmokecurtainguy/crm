import type * as React from "react";

const Logo = (props: React.SVGProps<SVGSVGElement>) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={512}
		height={512}
		viewBox="0 0 512 512"
		fill="none"
		aria-label="The Smoke Curtain Guy"
		{...props}
	>
		<rect x="40" y="40" width="432" height="432" rx="88" fill="currentColor" opacity="0.12" />
		<circle cx="256" cy="256" r="112" fill="#e3232f" />
		<path
			d="M120 372c40 0 52-38 92-38s60 44 100 44 52-30 84-30"
			stroke="currentColor"
			strokeWidth="26"
			strokeLinecap="round"
			fill="none"
			opacity="0.85"
		/>
		<path
			d="M148 150c30-2 46 24 74 22 30-2 44-32 82-30 28 1 42 22 70 22"
			stroke="currentColor"
			strokeWidth="22"
			strokeLinecap="round"
			fill="none"
			opacity="0.55"
		/>
	</svg>
);
export default Logo;
