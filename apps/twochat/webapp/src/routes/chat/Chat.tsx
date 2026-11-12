import { useChatView } from "./hooks/useChatView.js";
import { chatApi } from "../../lib/chat-client.js";
import { ChannelSidebar } from "./partials/ChannelSidebar.js";
import { ChatScene } from "./partials/ChatScene.js";
import { Composer } from "./partials/Composer.js";
import { NotificationsPanel } from "./partials/NotificationsPanel.js";
import { NewChannelDialog } from "./partials/NewChannelDialog.js";
import { StartDmDialog } from "./partials/StartDmDialog.js";

/**
 * The chat app: sidebar (channels/DMs) + scene (history/composer) +
 * notifications panel. All logic lives in useChatView + chat-context.
 */
export function Chat() {
  const view = useChatView();
  const { chat } = view;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <ChannelSidebar
        channels={chat.channels}
        activeChannelId={chat.activeChannelId}
        myUserId={chat.myUserId}
        channelTitle={chat.channelTitle}
        online={chat.online}
        onSelect={chat.setActiveChannel}
        onCreateChannel={() => view.setNewChannelOpen(true)}
        onStartDm={() => view.setStartDmOpen(true)}
      />

      <ChatScene
        channel={view.activeChannel}
        channelTitle={view.activeChannel ? chat.channelTitle(view.activeChannel) : ""}
        messages={view.messages}
        hasMore={chat.activeChannelId ? (chat.messagesByChannel[chat.activeChannelId]?.length ?? 0) >= 50 : false}
        myUserId={chat.myUserId}
        typingNames={view.typingNames}
        resolveMention={view.resolveMention}
        onLoadMore={() => chat.activeChannelId && void chat.loadMore(chat.activeChannelId)}
        onReact={(m, emoji) => void chat.react(m, emoji)}
        onReply={view.setReplyTo}
        onPin={(m) => void chat.pin(m)}
        onSave={(m) => void chat.save(m)}
        onDelete={(m) => void chat.remove(m)}
        onAction={(m, actionId, value) => void chatApi.invokeAction(m.id, actionId, value)}
      >
        {view.activeChannel ? (
          <Composer
            channelId={view.activeChannel.id}
            replyTo={view.replyTo}
            onCancelReply={() => view.setReplyTo(null)}
            onSend={view.onSend}
            onTyping={() => chat.activeChannelId && chat.sendTyping(chat.activeChannelId)}
            onUpload={view.onUpload}
            initialDraft={view.drafts[view.activeChannel.id] ?? ""}
            onDraftChange={view.onDraftChange}
            disabled={!view.isMember}
          />
        ) : null}
      </ChatScene>

      {view.notifsOpen ? (
        <NotificationsPanel
          notifications={chat.notifications}
          unread={chat.unreadNotifications}
          onRead={(id) => void chat.markNotificationRead(id)}
          onReadAll={() => void chat.markAllNotificationsRead()}
          onOpen={(channelId) => channelId && chat.setActiveChannel(channelId)}
          onClose={() => view.setNotifsOpen(false)}
        />
      ) : null}

      <NewChannelDialog
        open={view.newChannelOpen}
        error={view.newChannelError}
        onCreate={(name, topic) => void view.onCreateChannel(name, topic)}
        onClose={() => view.setNewChannelOpen(false)}
      />

      <StartDmDialog
        open={view.startDmOpen}
        error={view.startDmError}
        onStart={(participantId, kind) => void view.onStartDm(participantId, kind)}
        onClose={() => view.setStartDmOpen(false)}
      />

      {/* Notification bell — floats over the sidebar bottom; simple top-right toast-free inbox trigger */}
      <button
        type="button"
        aria-label="Toggle notifications"
        onClick={() => view.setNotifsOpen(!view.notifsOpen)}
        className="fixed bottom-4 left-56 z-40 grid size-9 place-items-center rounded-full border border-border bg-card shadow-md transition-transform hover:scale-105"
      >
        <span className="text-sm">🔔</span>
        {chat.unreadNotifications > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground">
            {chat.unreadNotifications > 9 ? "9+" : chat.unreadNotifications}
          </span>
        ) : null}
      </button>

      {chat.status !== "open" ? (
        <div className="pointer-events-none fixed left-1/2 top-2 z-50 -translate-x-1/2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-600">
          {chat.status === "connecting" ? "connecting…" : "reconnecting…"}
        </div>
      ) : null}
    </div>
  );
}
