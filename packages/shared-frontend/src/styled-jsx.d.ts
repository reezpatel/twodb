// styled-jsx JSX prop augmentation — enables `<style jsx>` on style elements.
import "react";

declare module "react" {
	interface StyleHTMLAttributes<T> extends HTMLAttributes<T> {
		jsx?: boolean;
		global?: boolean;
	}
}
