import { useState } from "react";
import {
  Avatar,
  Button,
  IconButton,
  Tabs,
  Textarea,
} from "@twodb/ui";
import {
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Link2,
  Mail,
  Check,
  Paperclip,
  Pencil,
  Pause,
  Phone,
  Play,
  Send,
  Sparkles,
} from "lucide-react";

/* ---------------- data ---------------- */

const WAVEFORM = [
  5, 9, 14, 20, 12, 8, 16, 22, 26, 18, 10, 7, 13, 21, 25, 28, 22, 14, 9, 15,
  24, 27, 19, 11, 6, 10, 17, 23, 26, 20, 12, 8, 14, 18, 22, 16, 10, 6, 12, 19,
  24, 21, 13, 8, 5, 9, 15, 11, 7, 4,
];

const TRANSCRIPT = [
  { who: "Tyler Bennett", text: "Hi, I need to move my appointment — something came up at work." },
  { who: "Reception", text: "Of course. We have December 1st at 12:00 PM open, does that suit you?" },
  { who: "Tyler Bennett", text: "That's perfect. You'll send the confirmation over email?" },
  { who: "Reception", text: "Yes — it's on its way now, along with the preparation notes." },
];

const HISTORY = [
  { id: "h1", kind: "mail", from: "Tyler", initials: "DR", tone: "neutral", text: "Hello. Unfortunately, none of these date…", time: "13:21" },
  { id: "h2", kind: "mail", from: "Weronika", initials: "WL", tone: "cobalt", text: "The cost of removing one wisdom tooth…", time: "12:37" },
  { id: "h3", kind: "call", from: "Tyler", initials: "DR", tone: "neutral", text: "4:32", time: "09:45" },
  { id: "h4", kind: "mail", from: "Tyler", initials: "DR", tone: "neutral", text: "Alright.", time: "09:22" },
  { id: "divider", label: "August 16, 2025" },
  { id: "h5", kind: "mail", from: "Weronika", initials: "WL", tone: "cobalt", text: "Great!", time: "16:32" },
  { id: "h6", kind: "mail", from: "Tyler", initials: "DR", tone: "neutral", text: "OK", time: "14:21" },
  { id: "h7", kind: "mail", from: "ReceptionOS", initials: "RO", tone: "rose", text: "Dear Mr. Tyler,…", time: "13:05" },
];

/* ---------------- main ---------------- */

export function CommunicationMock() {
  const [playing, setPlaying] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [tasks, setTasks] = useState(0);
  const [suggestionDone, setSuggestionDone] = useState(false);
  const [channel, setChannel] = useState("email");
  const [sentFlash, setSentFlash] = useState(false);

  return (
    <div className="mock-cm">
      {/* thread */}
      <section className="mock-cm__thread">
        <div className="mock-cm__dayline">
          <span>Today</span>
        </div>

        {/* call recording card */}
        <div className="mock-cm__call">
          <div className="mock-cm__call-head">
            <strong>Call Ended</strong>
            <span>From Tyler Bennett</span>
          </div>
          <div className="mock-cm__wave">
            <IconButton
              label={playing ? "Pause recording" : "Play recording"}
              icon={playing ? <Pause /> : <Play />}
              onClick={() => setPlaying((p) => !p)}
              className="mock-cm__play"
            />
            <div className="mock-cm__bars" aria-hidden="true">
              {WAVEFORM.map((h, i) => (
                <i
                  key={i}
                  style={{ height: h }}
                  className={playing ? "mock-cm__bar mock-cm__bar--live" : "mock-cm__bar"}
                />
              ))}
            </div>
          </div>
          <div className="mock-cm__call-foot">
            <span className="tw-tnum">8:11</span>
            <span className="mock-cm__stamp tw-tnum">
              <Phone size={11} aria-hidden="true" /> 13:21
            </span>
          </div>
        </div>

        {/* transcription disclosure */}
        <button
          type="button"
          className="mock-cm__disclosure"
          onClick={() => setTranscriptOpen((o) => !o)}
          aria-expanded={transcriptOpen}
        >
          Transcription
          {transcriptOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {transcriptOpen ? (
          <div className="mock-cm__transcript">
            {TRANSCRIPT.map((line, i) => (
              <p key={i}>
                <strong>{line.who}:</strong> {line.text}
              </p>
            ))}
          </div>
        ) : null}

        {/* sent mail bubble */}
        <div className="mock-cm__bubble-row">
          <div className="mock-cm__bubble">
            <p>
              Dear Mr. Tyler,
              <br />
              <br />
              I confirm the appointment reservation for December 1st, 2025 at 12:00 PM.
            </p>
            <span className="mock-cm__stamp mock-cm__stamp--light tw-tnum">
              <Mail size={11} aria-hidden="true" /> 13:21
            </span>
          </div>
          <Avatar name="Weronika Lask" size="sm" />
        </div>

        {/* AI suggestion */}
        <div className={suggestionDone ? "mock-cm__suggest mock-cm__suggest--done" : "mock-cm__suggest"}>
          <Lightbulb size={15} aria-hidden="true" />
          <span>Send the document with recommendations</span>
          <IconButton
            label={suggestionDone ? "Added to tasks" : "Confirm suggestion"}
            icon={<Check />}
            className={suggestionDone ? "mock-cm__suggest-check mock-cm__suggest-check--done" : "mock-cm__suggest-check"}
            onClick={() => {
              if (!suggestionDone) {
                setSuggestionDone(true);
                setTasks((t) => t + 1);
              }
            }}
          />
        </div>

        {/* composer */}
        <div className="mock-cm__composer">
          <Tabs
            aria-label="Channel"
            value={channel}
            onValueChange={setChannel}
            items={[
              { id: "email", label: "Email" },
              { id: "sms", label: "SMS" },
            ]}
          />
          <div className="mock-cm__field-row">
            <span className="tw-cue">To</span>
            <span className="mock-cm__chip">t.bennett@email.com</span>
            <span className="mock-cm__cc">Cc</span>
          </div>
          <div className="mock-cm__field-row">
            <span className="tw-cue">Subject</span>
            <span className="mock-cm__subject">Appointment Confirmation</span>
          </div>
          <Textarea
            aria-label="Message body"
            placeholder={channel === "email" ? "Write the email…" : "Write the SMS — keep it short…"}
            rows={channel === "sms" ? 2 : 4}
          />
          <div className="mock-cm__composer-foot">
            <IconButton label="AI assist" icon={<Sparkles />} />
            <IconButton label="Attach" icon={<Paperclip />} />
            <IconButton label="Insert link" icon={<Link2 />} />
            <Button
              className="mock-cm__send"
              onClick={() => {
                setSentFlash(true);
                setTimeout(() => setSentFlash(false), 1800);
              }}
            >
              {sentFlash ? "Sent ✓" : "Send"}
              {!sentFlash ? <Send size={14} aria-hidden="true" /> : null}
            </Button>
          </div>
        </div>
      </section>

      {/* contact panel */}
      <aside className="mock-cm__panel">
        <div className="mock-cm__tasks">
          <div className="mock-cm__tasks-head">
            <strong>Completed tasks</strong>
            <span className="tw-tnum">{tasks} out of 2</span>
          </div>
          <div className="mock-cm__progress">
            <i style={{ transform: `scaleX(${tasks / 2})` }} />
          </div>
        </div>

        <div className="mock-cm__contact">
          <div className="mock-cm__contact-head">
            <h4>Tyler Bennett</h4>
            <IconButton size="sm" label="Edit contact" icon={<Pencil />} />
          </div>
          <span className="mock-cm__contact-line tw-tnum">
            <Phone size={13} aria-hidden="true" /> +48 598 450 302
          </span>
          <span className="mock-cm__contact-line">
            <Mail size={13} aria-hidden="true" /> t.bennett@email.com
          </span>
        </div>

        <div className="mock-cm__history">
          <h4>History</h4>
          {HISTORY.map((h) =>
            h.kind === "divider" ? (
              <div key={h.id} className="mock-cm__hist-divider tw-tnum">
                {h.label}
              </div>
            ) : (
              <div key={h.id} className="mock-cm__hist-row">
                <span className={`mock-cm__hist-avatar mock-cm__hist-avatar--${h.tone}`}>{h.initials}</span>
                <div className="mock-cm__hist-text">
                  <strong>
                    {h.kind === "call" ? "Voice call" : "Mail"} from {h.from}
                  </strong>
                  <span>{h.text}</span>
                </div>
                <span className="mock-cm__hist-time tw-tnum">{h.time}</span>
              </div>
            ),
          )}
        </div>
      </aside>
    </div>
  );
}
