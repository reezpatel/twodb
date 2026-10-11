import { useEffect, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { emailKeys, uploadForm, type EmailAccount, type EmailAddress, type EmailMessage } from "../email-api";

export interface ComposeValues {
  accountId: string;
  fromAddress: string;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  subject: string;
  bodyHtml: string;
  includeQuote: boolean;
}

const UNDO_SECONDS = 10;

function valuesOf(d: EmailMessage): ComposeValues {
  return {
    accountId: d.accountId,
    fromAddress: d.from?.address ?? "",
    to: d.to,
    cc: d.cc,
    bcc: d.bcc,
    subject: d.subject,
    bodyHtml: d.bodyHtml ?? "",
    includeQuote: d.includeQuote,
  };
}

export function useDraft(draftId: string) {
  return useQuery({ queryKey: emailKeys.draft(draftId), queryFn: () => api<EmailMessage>(`/api/email/drafts/${draftId}`), staleTime: Infinity });
}

/** Draft editing with debounced autosave (optimistic-concurrency on updatedAt), attachments, send/schedule and discard. */
export function useCompose(draft: EmailMessage, accounts: EmailAccount[], handlers: { onClose: () => void; onSent: (m: EmailMessage, undoSeconds: number) => void }) {
  const queryClient = useQueryClient();
  const savedAt = useRef(draft.updatedAt);
  const dirty = useRef(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "conflict" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [showCc, setShowCc] = useState(draft.cc.length > 0 || draft.bcc.length > 0);

  const save = async (value: ComposeValues) => {
    setSaveState("saving");
    try {
      const res = await api<{ updatedAt: string }>(`/api/email/drafts/${draft.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...value, accountId: draft.composeKind === "new" ? value.accountId : undefined, ifUpdatedAt: savedAt.current }),
      });
      savedAt.current = res.updatedAt;
      dirty.current = false;
      setSaveState("saved");
    } catch (e) {
      const msg = (e as Error).message;
      setSaveState(msg === "draft_conflict" ? "conflict" : "error");
      setError(msg === "draft_conflict" ? "This draft was changed elsewhere. Reload it to continue." : msg);
      throw e;
    }
  };

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const form = useForm({
    defaultValues: valuesOf(draft),
    listeners: {
      onChange: ({ formApi }) => {
        dirty.current = true;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void save(formApi.state.values).catch(() => {}), 1200);
      },
    },
  });

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const flush = async () => {
    if (timer.current) clearTimeout(timer.current);
    if (dirty.current) await save(form.state.values);
  };

  const attachments = useQuery({
    queryKey: [...emailKeys.draft(draft.id), "attachments"],
    queryFn: async () => (await api<EmailMessage>(`/api/email/drafts/${draft.id}`)).attachments,
    initialData: draft.attachments,
  });

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        await uploadForm(`/api/email/drafts/${draft.id}/attachments`, fd);
      }
    },
    onSuccess: () => void attachments.refetch(),
    onError: (e: Error) => setError(e.message),
  });

  const removeAttachment = useMutation({
    mutationFn: (attachmentId: string) => api(`/api/email/drafts/${draft.id}/attachments/${attachmentId}`, { method: "DELETE" }),
    onSuccess: () => void attachments.refetch(),
  });

  const invalidateLists = () => {
    void queryClient.invalidateQueries({ queryKey: emailKeys.threads });
    void queryClient.invalidateQueries({ queryKey: ["email", "counts"] });
    void queryClient.invalidateQueries({ queryKey: emailKeys.thread(draft.threadId) });
  };

  const send = useMutation({
    mutationFn: async (scheduledAt?: string) => {
      await flush();
      savedAt.current = (await api<EmailMessage>(`/api/email/drafts/${draft.id}`)).updatedAt;
      return api<EmailMessage>(`/api/email/drafts/${draft.id}/send`, {
        method: "POST",
        body: JSON.stringify({ scheduledAt: scheduledAt ?? null, undoSeconds: UNDO_SECONDS }),
      });
    },
    onSuccess: (message) => {
      invalidateLists();
      queryClient.removeQueries({ queryKey: emailKeys.draft(draft.id) });
      handlers.onSent(message, UNDO_SECONDS);
    },
    onError: (e: Error) => setError(e.message),
  });

  const discard = useMutation({
    mutationFn: () => api(`/api/email/drafts/${draft.id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateLists();
      queryClient.removeQueries({ queryKey: emailKeys.draft(draft.id) });
      handlers.onClose();
    },
  });

  const close = async () => {
    await flush().catch(() => {});
    invalidateLists();
    queryClient.removeQueries({ queryKey: emailKeys.draft(draft.id) });
    handlers.onClose();
  };

  const reload = () => {
    queryClient.removeQueries({ queryKey: emailKeys.draft(draft.id) });
    void queryClient.invalidateQueries({ queryKey: emailKeys.draft(draft.id) });
  };

  const fromOptions = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    return account ? [account.address, ...account.aliases] : [];
  };

  return { form, saveState, error, setError, showCc, setShowCc, attachments, upload, removeAttachment, send, discard, close, reload, fromOptions };
}
