import { Badge } from "@twodb/ui";
import { providerTemplatePickerStyles } from "./provider-template-picker.style";

export type ProviderOption = {
	id: string;
	label: string;
	badges?: string[];
};

type ProviderTemplatePickerProps = {
	options: ProviderOption[];
	onSelect: (option: ProviderOption) => void;
};

export function ProviderTemplatePicker({
	options,
	onSelect,
}: ProviderTemplatePickerProps) {
	return (
		<div className="template-picker">
			<style jsx>{providerTemplatePickerStyles}</style>
			{options.map((option) => (
				<button
					key={option.id}
					type="button"
					className="template-picker__card"
					onClick={() => onSelect(option)}
				>
					<span className="template-picker__label">{option.label}</span>
					<span className="template-picker__id">{option.id}</span>
					{option.badges?.length ? (
						<span className="template-picker__badges">
							{option.badges.map((badge) => (
								<Badge key={badge} size="sm">
									{badge}
								</Badge>
							))}
						</span>
					) : null}
				</button>
			))}
		</div>
	);
}
