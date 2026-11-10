import { useState } from "react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent, CollapsibleChevron, cn } from "@twodb/blocks";
import type { EndpointSpec } from "../../../lib/gateway-client.js";
import { SchemaView } from "./SchemaView.js";
import { TryItBar, TryItBody, TryItResult, hasRequestBody } from "./TryItBar.js";

/** One disclosure row: title + count badge + chevron, content below. */
function Section({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t border-outline">
      <CollapsibleTrigger>
        <span className="flex-1">{title}</span>
        {count !== undefined && count > 0 ? (
          <span className="rounded-full border border-outline bg-stone px-2 py-0.5 font-sans text-[10px] font-medium normal-case">
            {count}
          </span>
        ) : null}
        <CollapsibleChevron open={open} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* Padding on inner content, not on CollapsibleContent itself — its
            height is animated from the child's measured height. */}
        <div className="px-3 pt-0 pb-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export interface EndpointDialogBodyProps {
  appSlug: string;
  basePath: string;
  endpoint: EndpointSpec;
  pathInput: string;
  bodyInput: string;
  sending: boolean;
  result: { status: number; body: string } | null;
  onPathChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onSend: () => void;
}

/**
 * The dialog's body: request-builder-style try-it bar on top, then stacked
 * disclosures (request schema / response schema / body / response) — stacked
 * rather than tabbed because their heights differ a lot.
 * Dumb/presentational only.
 */
export function EndpointDialogBody(props: EndpointDialogBodyProps) {
  const { endpoint } = props;
  const reqProps = (endpoint.request as { properties?: Record<string, unknown> } | undefined)?.properties;
  const resProps = (endpoint.response as { properties?: Record<string, unknown> } | undefined)?.properties;
  const bodyful = hasRequestBody(endpoint);

  return (
    <div className="flex flex-col">
      <TryItBar
        endpoint={endpoint}
        appSlug={props.appSlug}
        pathInput={props.pathInput}
        sending={props.sending}
        onPathChange={props.onPathChange}
        onSend={props.onSend}
      />

      <div className="mt-4 overflow-hidden rounded-[10px] border border-outline bg-paper">
        {endpoint.request ? (
          <Section title="Request schema" count={Object.keys(reqProps ?? {}).length}>
            <SchemaView schema={endpoint.request} title="" />
          </Section>
        ) : null}
        {endpoint.response ? (
          <Section title="Response schema" count={Object.keys(resProps ?? {}).length}>
            <SchemaView schema={endpoint.response} title="" />
          </Section>
        ) : null}
        {bodyful ? (
          <Section title="Body" defaultOpen>
            <TryItBody value={props.bodyInput} onChange={props.onBodyChange} />
          </Section>
        ) : null}
        <Section title="Response">
          {props.result ? (
            <TryItResult result={props.result} />
          ) : (
            <p className={cn("text-[13px] text-ink-muted")}>Send a request to see the response here.</p>
          )}
        </Section>
      </div>
    </div>
  );
}

/** The full dialog content: header with method badge + path, then the body. */
export function EndpointDialogContent(props: EndpointDialogBodyProps) {
  return <EndpointDialogBody {...props} />;
}
