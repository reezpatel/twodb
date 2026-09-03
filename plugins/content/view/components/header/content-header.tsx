import { usePluginStore } from "react-pluggable";

export type ContentHeaderProps = {
	title?: string;
	children?: React.ReactNode;
};

export const ContentHeader = ({ title = "", children }: ContentHeaderProps) => {
	const pluginStore = usePluginStore();
	const Renderer = pluginStore.executeFunction("Renderer.getRendererComponent");

	return (
		<div className="shell__chrome shell__chrome--list">
			<Renderer placement="toggle_side_nav" />
			<strong className="shell__listtitle">{title}</strong>
			<span className="shell__chromespacer" />
			{children}

			<style jsx>{`
        .shell__chrome--list {
          grid-column: 1;
          grid-row: 1;
          display: flex;
          align-items: center;
          gap: 1px;
          min-width: 0;
          padding: 0 8px 0 12px;
          border-bottom: 1px solid var(--line);
          background: var(--surface);
        }

        .shell__chromespacer {
          flex: 1;
        }

        .shell__listtitle {
          font-size: var(--text-md);
          font-weight: 500;
          white-space: nowrap;
        }
      `}</style>
		</div>
	);
};
