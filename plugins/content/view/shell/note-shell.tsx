import { useParams } from "react-router";
import { SectionProvider } from "../provider/section-provider";
import { NoteListScene } from "../scenes/list-scene/list-scene";

export const NotesShell = () => {
  const { sectionId = "" } = useParams();

  return (
    <SectionProvider sectionId={sectionId}>
      <NoteListScene />
    </SectionProvider>
  );
};
