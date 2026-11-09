import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, WandSparkles, X } from "lucide-react";
import type { OverTypeInstance } from "overtype";
import { OvertypeEditor } from "@/components/overtype-editor";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EditorSheetProps {
  /** Stable identity of the document being edited (remounts the editor on change). */
  docKey: string | null;
  open: boolean;
  loading?: boolean;
  title: string;
  initialValue: string;
  /** Extra inputs rendered above the editor (tags, provider/model, …). */
  fields?: ReactNode;
  /** True when the header fields differ from the saved record. */
  fieldsDirty?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  error?: string | null;
  savePending?: boolean;
  submitLabel: string;
  onSubmit: (content: string) => void;
  onClose: () => void;
}

/** Full-height markdown sheet (OverType) with format button, unsaved-changes guard and floating save. */
export function EditorSheet({
  docKey,
  open,
  loading,
  title,
  initialValue,
  fields,
  fieldsDirty,
  placeholder,
  ariaLabel,
  error,
  savePending,
  submitLabel,
  onSubmit,
  onClose,
}: EditorSheetProps) {
  const [content, setContent] = useState(initialValue);
  useEffect(() => setContent(initialValue), [initialValue]);

  const dirty = content !== initialValue || Boolean(fieldsDirty);
  const [confirmClose, setConfirmClose] = useState(false);
  const requestClose = () => {
    if (dirty) setConfirmClose(true);
    else onClose();
  };

  const editorRef = useRef<OverTypeInstance | null>(null);
  const [formatting, setFormatting] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);

  const formatDoc = async () => {
    const editor = editorRef.current;
    if (!editor || formatting) return;
    setFormatting(true);
    try {
      const [{ format }, markdown] = await Promise.all([import("prettier/standalone"), import("prettier/plugins/markdown")]);
      const formatted = await format(editor.getValue(), { parser: "markdown", plugins: [markdown], embeddedLanguageFormatting: "off" });
      editor.setValue(formatted);
      setContent(formatted);
      setFormatError(null);
    } catch (e) {
      setFormatError((e as Error).message);
    } finally {
      setFormatting(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => !next && requestClose()}>
        <SheetContent side="right" showCloseButton={false} className="w-full gap-4 overflow-hidden p-0 sm:max-w-[70%]">
          <SheetTitle className="sr-only">{title}</SheetTitle>
          <div className="absolute top-4 right-4 z-10 flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              title="Format markdown"
              aria-label="Format markdown"
              className="bg-background/80 backdrop-blur"
              disabled={formatting || loading}
              onClick={() => void formatDoc()}
            >
              {formatting ? <Loader2 size={14} className="animate-spin" /> : <WandSparkles size={14} />}
            </Button>
            <Button variant="ghost" size="icon-sm" title="Close" aria-label="Close" className="bg-background/80 backdrop-blur" onClick={requestClose}>
              <X size={14} />
            </Button>
          </div>
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="text-muted-foreground animate-spin" size={18} />
            </div>
          ) : (
            <>
              {fields && <div className="bg-background z-10 flex flex-col gap-2 border-b px-6 pt-12 pb-3">{fields}</div>}
              <OvertypeEditor
                key={docKey}
                ref={editorRef}
                value={initialValue}
                onChange={setContent}
                placeholder={placeholder}
                ariaLabel={ariaLabel}
                className="min-h-0 flex-1 overflow-hidden"
              />
              {(error || formatError) && (
                <p className="text-destructive bg-background/80 absolute bottom-4 left-4 z-10 rounded-md px-2 py-1 text-xs backdrop-blur">
                  {error || formatError}
                </p>
              )}
              <Button
                onClick={() => onSubmit(content)}
                variant="secondary"
                disabled={savePending || loading}
                className="absolute right-4 bottom-4 z-10 border backdrop-blur"
              >
                {savePending ? "Saving…" : submitLabel}
              </Button>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>Your edits will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onClose}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
