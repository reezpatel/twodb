import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView } from "@codemirror/view";

const extensions = [markdown({ codeLanguages: languages }), EditorView.lineWrapping];

export function MarkdownEditor(props: { value: string; onChange(v: string): void; readOnly?: boolean }) {
  return (
    <CodeMirror
      value={props.value}
      height="100%"
      className="h-full text-[14px]"
      extensions={extensions}
      readOnly={props.readOnly}
      basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
      onChange={props.onChange}
    />
  );
}
