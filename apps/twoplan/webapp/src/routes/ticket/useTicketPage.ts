import { useNavigate } from "react-router";
import { del, patch, post, put, uploadAttachment, attachmentUrl } from "../../lib/api";
import { useActivity, useApiMutation, useTicket } from "../../lib/queries";
import { useProjectCtx } from "../../lib/project-context";
import { useMembers } from "../../lib/members";

/** Holding hook for the ticket detail page: the ticket, its feed and every mutation the panels need. */
export function useTicketPage(ident: string) {
  const { project } = useProjectCtx();
  const nav = useNavigate();
  const { me } = useMembers();
  const ticket = useTicket(ident);
  const activity = useActivity(ident);
  const id = ticket.data?.id ?? ident;

  const update = useApiMutation((body: Record<string, unknown>) => patch(`/tickets/${id}`, body));
  const comment = useApiMutation((body: string) => post(`/tickets/${id}/comments`, { body }));
  const editComment = useApiMutation((v: { id: string; body: string }) => patch(`/tickets/${id}/comments/${v.id}`, { body: v.body }));
  const removeComment = useApiMutation((cid: string) => del(`/tickets/${id}/comments/${cid}`));
  const archive = useApiMutation((restore: boolean) => post(`/tickets/${id}/archive`, { restore }));
  const remove = useApiMutation(() => del(`/tickets/${id}`), { onSuccess: () => nav(`/p/${project.key}/tickets`) });
  const watch = useApiMutation((watching: boolean) => put(`/tickets/${id}/watch`, { watching }));
  const setField = useApiMutation((v: { fieldId: string; value: unknown }) => put(`/tickets/${id}/fields/${v.fieldId}`, { value: v.value }));

  const checklist = {
    add: useApiMutation((title: string) => post(`/tickets/${id}/checklists`, { title })),
    rename: useApiMutation((v: { id: string; title: string }) => patch(`/tickets/${id}/checklists/${v.id}`, { title: v.title })),
    remove: useApiMutation((cid: string) => del(`/tickets/${id}/checklists/${cid}`)),
    addItem: useApiMutation((v: { checklistId: string; text: string }) => post(`/tickets/${id}/checklists/${v.checklistId}/items`, { text: v.text })),
    updateItem: useApiMutation((v: { id: string; text?: string; done?: boolean }) => patch(`/tickets/${id}/checklist-items/${v.id}`, v)),
    removeItem: useApiMutation((iid: string) => del(`/tickets/${id}/checklist-items/${iid}`)),
  };
  const links = {
    add: useApiMutation((v: { targetTicketId: string; relation: string }) => post(`/tickets/${id}/links`, v)),
    remove: useApiMutation((lid: string) => del(`/tickets/${id}/links/${lid}`)),
  };
  const dev = {
    add: useApiMutation((v: Record<string, unknown>) => post(`/tickets/${id}/dev-links`, v)),
    update: useApiMutation((v: { id: string } & Record<string, unknown>) => patch(`/tickets/${id}/dev-links/${v.id}`, v)),
    remove: useApiMutation((did: string) => del(`/tickets/${id}/dev-links/${did}`)),
  };
  const attachments = {
    upload: useApiMutation((files: File[]) => Promise.all(files.map((f) => uploadAttachment(id, f)))),
    remove: useApiMutation((aid: string) => del(`/tickets/${id}/attachments/${aid}`)),
    /** For the editor: store the pasted/dropped image as an attachment and hand back its URL. */
    uploadImage: async (file: File) => attachmentUrl(id, (await uploadAttachment(id, file)).id),
    url: (aid: string) => attachmentUrl(id, aid),
  };
  return { ticket, activity, me, update, comment, editComment, removeComment, archive, remove, watch, setField, checklist, links, dev, attachments };
}
export type TicketPageApi = ReturnType<typeof useTicketPage>;
