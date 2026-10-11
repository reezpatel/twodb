import { useQuery } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { api } from "@/lib/api";
import { contactKeys, type Contact, type ContactActivity } from "./contacts-api";

export function useContactDetail(contact: Contact, onSave: (patch: { name: string; notes: string }) => Promise<unknown>) {
  const activity = useQuery({ queryKey: contactKeys.activity(contact.id), queryFn: () => api<ContactActivity>(`/api/contacts/${contact.id}/activity`) });
  const form = useForm({
    defaultValues: { name: contact.name ?? "", notes: contact.notes ?? "" },
    onSubmit: async ({ value }) => {
      await onSave(value);
    },
  });
  return { activity, form };
}
