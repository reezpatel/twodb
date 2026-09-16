import { useEffect } from "react";
import { useForm } from "@tanstack/react-form";
import { Button, Input, Kbd } from "@twodb/ui";
import { Check } from "lucide-react";
import { useInstance } from "../../hooks/use-instance";
import { instanceSectionStyles } from "./instance-section.style";

export function InstanceSection() {
  const { instanceQuery, renameInstance } = useInstance();
  const instance = instanceQuery.data;

  const form = useForm({
    defaultValues: { name: instance?.name ?? "" },
    onSubmit: async ({ value }) => {
      const name = value.name.trim();
      if (name && name !== instance?.name) {
        await renameInstance.mutateAsync(name);
      }
    },
  });

  useEffect(() => {
    if (instance) form.reset({ name: instance.name });
  }, [instance?.id]);

  if (!instance) return null;

  return (
    <section className="instance-page">
      <style jsx>{instanceSectionStyles}</style>
      <header className="instance-page__header">
        <div>
          <h1>Instance</h1>
          <p>This deployment's identity. Generated once at first boot.</p>
        </div>
      </header>

      <dl className="instance-page__status">
        <div>
          <dt>Instance ID</dt>
          <dd>
            <Kbd>{instance.id}</Kbd>
          </dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{new Date(instance.created_at).toLocaleString()}</dd>
        </div>
      </dl>

      <form
        className="instance-page__form"
        onSubmit={(event) => {
          event.preventDefault();
          form.handleSubmit();
        }}
      >
        <form.Field name="name">
          {(field) => (
            <Input
              size="lg"
              style={{ width: "100%" }}
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
              onBlur={field.handleBlur}
              aria-label="Instance name"
            />
          )}
        </form.Field>
        <Button
          type="submit"
          variant="secondary"
          size="lg"
          disabled={renameInstance.isPending}
        >
          <Check aria-hidden="true" size={16} />
          Rename
        </Button>
      </form>
    </section>
  );
}
