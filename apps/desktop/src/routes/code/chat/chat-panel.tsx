import { useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { PanelRight } from "lucide-react";
import { useChat } from "./use-chat-panel";
import { ChatConversationInner } from "./chat-conversation";
import { AwsChip } from "./aws-chip";
import { CHAT_TABS, type ChatTabId } from "./chat-tabs";
import { useChatShortcuts } from "./use-chat-shortcuts";
import { EditorScreen } from "./screens/editor-screen";
import { useCode } from "../code-provider";
import { CodeHeader } from "@/components/blocks/code/code-header/code-header";
import { CodeHeaderAction, CodeHeaderActions } from "@/components/blocks/code/code-header/code-header-actions";
import { CodeHeaderSeparator } from "@/components/blocks/code/code-header/code-header-separator";
import { CodeHeaderStatus } from "@/components/blocks/code/code-header/code-header-status";
import { CodeHeaderTab, CodeHeaderTabs } from "@/components/blocks/code/code-header/code-header-tabs";
import { CodeHeaderWidgets } from "@/components/blocks/code/code-header/code-header-widgets";
import { CodeHeaderWorking } from "@/components/blocks/code/code-header/code-header-working";
import { formatShortcut } from "@/lib/shortcut-keys";
import { urls } from "@/lib/url-registry";

const WS_STATUS = {
  open: { status: "live", label: "Connected" },
  connecting: { status: "connecting", label: "Reconnecting" },
  closed: { status: "offline", label: "Disconnected" },
} as const;

export function ChatPanel() {
  const { streaming, wsStatus, round } = useChat();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { rightBarVisible, toggleRightBar } = useCode();
  const navigate = useNavigate();
  const location = useLocation();
  const running = streaming !== null;
  const activePanel = location.pathname.split("/")[4] ?? null;
  const connection = WS_STATUS[wsStatus];

  const isActive = useCallback((id: ChatTabId) => (id === "chat" ? !activePanel : activePanel === id), [activePanel]);

  // Selecting the active panel again closes it — back to the default sections
  // (the editor tab is main-column, not a panel).
  const selectTab = useCallback(
    (id: ChatTabId) => {
      if (!sessionId) return;
      if (id === "chat" || (id !== "editor" && isActive(id))) navigate(urls.code.session(sessionId), { replace: id !== "chat" });
      else navigate(urls.code.session(sessionId, id));
    },
    [isActive, navigate, sessionId],
  );

  useChatShortcuts({ tabs: CHAT_TABS.map((tab) => () => selectTab(tab.id)), togglePanel: toggleRightBar });

  const panelLabel = rightBarVisible ? "Hide right panel" : "Show right panel";

  return (
    <>
      <CodeHeader>
        <CodeHeaderTabs>
          {CHAT_TABS.map((tab, index) => (
            <CodeHeaderTab
              key={tab.id}
              icon={<tab.icon />}
              label={tab.label}
              shortcut={formatShortcut(["mod", String(index + 1)])}
              active={isActive(tab.id)}
              onClick={() => selectTab(tab.id)}
            />
          ))}
        </CodeHeaderTabs>
        <CodeHeaderSeparator />
        <CodeHeaderWidgets>{sessionId && <AwsChip sessionId={sessionId} />}</CodeHeaderWidgets>
        <CodeHeaderActions>
          {running && <CodeHeaderWorking label={`working${round !== null ? ` · round ${round}` : ""}`} />}
          <CodeHeaderStatus status={connection.status} label={connection.label} />
          <CodeHeaderAction
            icon={<PanelRight />}
            label={panelLabel}
            shortcut={formatShortcut(["mod", "alt", "B"])}
            active={rightBarVisible}
            onClick={toggleRightBar}
          />
        </CodeHeaderActions>
      </CodeHeader>

      {activePanel === "editor" && sessionId ? (
        <div className="min-h-0 flex-1">
          <EditorScreen sessionId={sessionId} />
        </div>
      ) : sessionId ? (
        <ChatConversationInner sessionId={sessionId} />
      ) : null}
    </>
  );
}
