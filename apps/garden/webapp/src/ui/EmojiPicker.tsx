import { useMemo, useState } from "react";

// Compact curated set (no dependency): enough for page icons, grouped like AFFiNE's picker.
const GROUPS: { name: string; emojis: string }[] = [
  { name: "Smileys", emojis: "😀😃😄😁😆🥹😅😂🤣🥲☺️😊😇🙂🙃😉😌😍🥰😘😋😛😜🤪🤨🧐🤓😎🥸🤩🥳😏😒😞😔😟😕🙁😣😖😫😩🥺😢😭😤😠😡🤯😳🥵🥶😱😨😰😥😓🤗🤔🫣🤭🫢🤫🤥😶😐😑😬🙄😯😦😧😮😲🥱😴🤤😪😵🤐🥴🤢🤮🤧😷🤒🤕" },
  { name: "People", emojis: "👋🤚🖐️✋🖖👌🤌🤏✌️🤞🫰🤟🤘🤙👈👉👆👇☝️👍👎✊👊🤛🤜👏🙌🫶👐🤲🤝🙏✍️💪🧠👀👁️👤👥🧑‍💻👩‍🔬🧑‍🎨🧑‍🚀🧑‍🏫🧑‍🍳" },
  { name: "Nature", emojis: "🌱🌿☘️🍀🌵🌲🌳🌴🪴🍃🍂🍁🌾🌷🌹🥀🌺🌸🌼🌻🌞🌝🌛⭐🌟✨⚡🔥🌈☀️⛅☁️🌧️❄️🌊💧🐶🐱🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🦉🦋🐝🐞🐢🐙🐳🐬" },
  { name: "Food", emojis: "🍏🍎🍐🍊🍋🍌🍉🍇🍓🫐🍒🍑🥭🍍🥥🥝🍅🥑🥦🥕🌽🌶️🥐🍞🧀🥚🍳🥞🥓🍔🍟🍕🌮🍣🍜🍝🍰🎂🍪🍩🍫🍿☕🍵🧃🍷🍺" },
  { name: "Objects", emojis: "💡🔦🕯️📱💻⌨️🖥️🖨️🖱️💾💿📷🎥📺📻⏰⌛📡🔋🔌💰💳💎⚖️🧰🔧🔨⚙️🧲🔬🔭💊🩺🧬🧪🌡️🧹🧺🧻🛒🎁🎈🎉🎊📦📫📮📝📄📃📑📊📈📉🗂️📁📂🗃️🗄️📅📆🗓️📇📋📌📍📎🖇️📏📐✂️🖊️🖋️✒️🖌️🖍️✏️🔍🔎🔒🔓🔑🗝️🏷️📚📖📕📗📘📙📓📔📒" },
  { name: "Travel", emojis: "🚗🚕🚙🚌🏎️🚓🚑🚒🚲🛴✈️🚀🛸🚁⛵🚤🚢⚓🗺️🧭🏔️⛰️🌋🏕️🏖️🏜️🏝️🏞️🏟️🏛️🏗️🏠🏡🏢🏬🏣🏥🏦🏨🏪🏫🏰🗼🗽⛪🕌🌁🌃🌄🌅🌆🌇🌉" },
  { name: "Symbols", emojis: "❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝✅☑️✔️❌❎➕➖➗✖️♾️❓❗‼️⁉️💯🔴🟠🟡🟢🔵🟣⚫⚪🟥🟧🟨🟩🟦🟪⬛⬜🔶🔷🔸🔹🔺🔻💠🔘🏁🚩🎯🏆🥇🥈🥉🎖️🏅" },
];

const split = (s: string) => Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s), (x) => x.segment);

export function EmojiPicker({ onPick, onRemove }: { onPick: (emoji: string) => void; onRemove?: () => void }) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => GROUPS.map((g) => ({ ...g, list: split(g.emojis) })), []);
  const filtered = q ? groups.filter((g) => g.name.toLowerCase().includes(q.toLowerCase())) : groups;
  return (
    <div className="w-[330px]">
      <div className="flex items-center gap-2 border-b border-outline p-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by group…"
          className="h-7 min-w-0 flex-1 rounded-md bg-ink/[0.04] px-2 text-[13px] outline-none placeholder:text-ink-muted"
        />
        {onRemove ? (
          <button type="button" onClick={onRemove} className="rounded-md px-2 py-1 text-xs text-ink-muted hover:bg-ink/[0.06] hover:text-ink">
            Remove
          </button>
        ) : null}
      </div>
      <div className="max-h-[300px] overflow-y-auto p-2">
        {filtered.map((g) => (
          <div key={g.name} className="mb-2">
            <div className="px-1 pb-1 text-[11.5px] font-semibold text-ink-muted">{g.name}</div>
            <div className="grid grid-cols-9 gap-0.5">
              {g.list.map((e, i) => (
                <button key={`${e}${i}`} type="button" className="flex size-8 items-center justify-center rounded-md text-[19px] hover:bg-ink/[0.07]" onClick={() => onPick(e)}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const randomEmoji = () => {
  const all = split(GROUPS[2].emojis + GROUPS[4].emojis);
  return all[Math.floor(Math.random() * all.length)];
};
