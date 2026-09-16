export const required = (message: string) => ({
	onChange: ({ value }: { value: string }) =>
		value.trim().length === 0 ? message : undefined,
});
