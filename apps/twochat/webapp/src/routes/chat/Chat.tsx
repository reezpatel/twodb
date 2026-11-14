import { LockKeyhole } from "lucide-react";
import { useChatView } from "./hooks/useChatView.js";
import { chatApi } from "../../lib/chat-client.js";
import { ChannelSidebar } from "./partials/ChannelSidebar.js";
import { ChatScene } from "./partials/ChatScene.js";
import { Composer } from "./partials/Composer.js";
import { NotificationsPanel } from "./partials/NotificationsPanel.js";
import { NewChannelDialog } from "./partials/NewChannelDialog.js";
import { AddListDialog } from "./partials/AddListDialog.js";
import { StartDmDialog } from "./partials/StartDmDialog.js";

/** List-group sidebar + one common conversation scene for writable/read-only conversations. */
export function Chat() {
  const view = useChatView();
  const { chat } = view;
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <ChannelSidebar
        lists={view.lists}
        activeListId={view.activeListId}
        onListChange={view.setActiveListId}
        onAddList={() => view.setAddListOpen(true)}
        conversations={view.activeConversations}
        activeChannelId={chat.activeChannelId}
        myUserId={chat.myUserId}
        channelTitle={chat.channelTitle}
        online={chat.online}
        previews={view.sidebarPreviews}
        search={view.sidebarSearch}
        unreadNotifications={chat.unreadNotifications}
        onSearchChange={view.setSidebarSearch}
        onSelect={chat.setActiveChannel}
        onCreateChannel={() => view.setNewChannelOpen(true)}
        onStartDm={() => view.setStartDmOpen(true)}
        onOpenNotifications={() => view.setNotifsOpen(!view.notifsOpen)}
      />

      <ChatScene
        channel={view.activeChannel}
        channelTitle={view.activeChannel ? chat.channelTitle(view.activeChannel) : ""}
        messages={view.messages}
        hasMore={chat.activeChannelId ? (chat.messagesByChannel[chat.activeChannelId]?.length ?? 0) >= 50 : false}
        myUserId={chat.myUserId}
        readOnly={view.activeChannel?.isReadOnly}
        typingNames={view.activeChannel?.isReadOnly ? [] : view.typingNames}
        resolveMention={view.resolveMention}
        onLoadMore={() => chat.activeChannelId && void chat.loadMore(chat.activeChannelId)}
        onReact={(message, emoji) => !view.activeChannel?.isReadOnly && void chat.react(message, emoji)}
        onReply={(message) => !view.activeChannel?.isReadOnly && view.setReplyTo(message)}
        onPin={(message) => !view.activeChannel?.isReadOnly && void chat.pin(message)}
        onSave={(message) => void chat.save(message)}
        onDelete={(message) => !view.activeChannel?.isReadOnly && void chat.remove(message)}
        onAction={(message, actionId, value) => !view.activeChannel?.isReadOnly && void chatApi.invokeAction(message.id, actionId, value)}
      >
        {view.activeChannel?.isReadOnly ? (
          <div className="flex items-center justify-center gap-1.5 border-t border-border bg-card px-4 py-3 text-xs text-muted-foreground">
            <LockKeyhole size={12} /> Read-only local copy{view.activeChannel.sourceProvider ? ` from ${view.activeChannel.sourceProvider}` : ""}.
            {view.activeChannel.sourceUrl ? <a href={view.activeChannel.sourceUrl} target="_blank" rel="noopener" className="text-primary hover:underline">Open source</a> : null}
          </div>
        ) : view.activeChannel ? (
          <Composer
            channelId={view.activeChannel.id}
            members={view.activeChannel.members}
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

      {view.notifsOpen ? <NotificationsPanel notifications={chat.notifications} unread={chat.unreadNotifications} onRead={(id) => void chat.markNotificationRead(id)} onReadAll={() => void chat.markAllNotificationsRead()} onOpen={(channelId) => channelId && chat.setActiveChannel(channelId)} onClose={() => view.setNotifsOpen(false)} /> : null}
      <NewChannelDialog open={view.newChannelOpen} error={view.newChannelError} onCreate={(name, topic) => void view.onCreateChannel(name, topic)} onClose={() => view.setNewChannelOpen(false)} />
      <StartDmDialog open={view.startDmOpen} error={view.startDmError} onStart={(participantId, kind) => void view.onStartDm(participantId, kind)} onClose={() => view.setStartDmOpen(false)} />
      <AddListDialog open={view.addListOpen} spaces={view.spaces} error={view.addListError} onCreate={(name, spaceId) => void view.onCreateList(name, spaceId)} onClose={() => view.setAddListOpen(false)} />

      {chat.status !== "open" ? <div className="pointer-events-none fixed left-1/2 top-2 z-50 -translate-x-1/2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-600">{chat.status === "connecting" ? "connecting…" : "reconnecting…"}</div> : null}
    </div>
  );
}
