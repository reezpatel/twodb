import { useState } from "react";

export interface BriefAppointment {
  name: string;
  reason: string;
  time: string;
  prep?: string;
}

export interface BriefTask {
  id: string;
  title: string;
  done?: boolean;
}

const APPOINTMENTS: BriefAppointment[] = [
  { name: "Ravi Kumar", reason: "Follow-up · discharge review", time: "9:00 am" },
  { name: "Meera Iyer", reason: "Lab draw — fasting panel", time: "9:40 am", prep: "Prep soon" },
  { name: "Arjun Nair", reason: "Physio, session 4 of 8", time: "11:15 am" },
  { name: "Sana Sheikh", reason: "New patient intake", time: "12:30 pm", prep: "Prep soon" },
];

const FRONT_DESK_TASKS: BriefTask[] = [
  { id: "fd1", title: "Confirm Tuesday's visiting hours with Dr. Rao" },
  { id: "fd2", title: "Print consent forms for the afternoon list" },
  { id: "fd3", title: "Call the lab about the two pending reports" },
];

const LAB_TASKS: BriefTask[] = [
  { id: "lb1", title: "Label yesterday's samples before 10 am", done: true },
  { id: "lb2", title: "Calibrate the analyzer — log sheet in drawer" },
];

/** Morning-brief state — the day's appointments and checkable task groups. */
export function useOverviewScene() {
  const [appointments] = useState(APPOINTMENTS);
  const [frontDesk, setFrontDesk] = useState(FRONT_DESK_TASKS);
  const [lab, setLab] = useState(LAB_TASKS);

  function toggle(setter: typeof setFrontDesk, id: string, done: boolean) {
    setter((ts) => [...ts].map((t) => (t.id === id ? { ...t, done } : t)).sort((a, b) => Number(!!a.done) - Number(!!b.done)));
  }

  function snooze(setter: typeof setFrontDesk, id: string) {
    setter((ts) => {
      const task = ts.find((t) => t.id === id);
      if (!task) return ts;
      return [...ts.filter((t) => t.id !== id), task];
    });
  }

  return { appointments, frontDesk, lab, setFrontDesk, setLab, toggle, snooze };
}
