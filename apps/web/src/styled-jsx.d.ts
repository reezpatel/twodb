// styled-jsx JSX prop augmentation — the package ships this as
// global.d.ts but nothing references it automatically, so we declare it
// here. Enables `<style jsx>` on style elements.
import "react";

declare module "react" {
	interface StyleHTMLAttributes<T> extends HTMLAttributes<T> {
		jsx?: boolean;
		global?: boolean;
	}
}
