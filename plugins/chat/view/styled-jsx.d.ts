import "react";

declare module "react" {
	interface StyleHTMLAttributes<T> extends HTMLAttributes<T> {
		jsx?: boolean;
		global?: boolean;
	}
}

declare module "styled-jsx/css" {
	const css: {
		(strings: TemplateStringsArray, ...values: unknown[]): string;
		global: (strings: TemplateStringsArray, ...values: unknown[]) => string;
	};
	export default css;
}
