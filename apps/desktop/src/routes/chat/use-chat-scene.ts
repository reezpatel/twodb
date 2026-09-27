import { useState } from "react";

export interface ChatPost {
  id: string;
  author: string;
  when: string;
  body: string;
  reactions?: { emoji: string; count: number }[];
  linkCard?: { title: string; url: string };
}

export interface ChatMember {
  name: string;
  role: string;
  team: "Design" | "Management" | "Development";
  online?: boolean;
}

export interface ChatChannel {
  id: string;
  label: string;
  depth: number;
  count?: number;
}

const MEMBERS: ChatMember[] = [
  { name: "Daniel Anderson", role: "Art director", team: "Design", online: true },
  { name: "Andrew Miller", role: "Product owner", team: "Management", online: true },
  { name: "William Johnson", role: "UX/UI designer", team: "Design", online: true },
  { name: "Emily Davis", role: "Front-end dev", team: "Development" },
  { name: "Diana Taylor", role: "UI designer", team: "Design", online: true },
  { name: "Sophia Wilson", role: "UX lead", team: "Design" },
  { name: "Liam Chen", role: "Front-end dev", team: "Development", online: true },
  { name: "Priya Nair", role: "QA engineer", team: "Development" },
  { name: "Noah Reed", role: "Strategy", team: "Management" },
];

const CHANNELS: ChatChannel[] = [
  { id: "general", label: "General", depth: 0, count: 1 },
  { id: "frontend", label: "Front-end", depth: 0, count: 4 },
  { id: "website", label: "Website", depth: 0 },
  { id: "v30", label: "v3.0", depth: 1 },
  { id: "wireframe", label: "Wireframe", depth: 2 },
  { id: "design", label: "Design", depth: 2 },
  { id: "uikit", label: "UI-kit design", depth: 2 },
  { id: "v20", label: "v2.0 — actual version", depth: 1 },
  { id: "strategy", label: "Strategy", depth: 0 },
  { id: "events", label: "Events", depth: 0 },
  { id: "announcements", label: "Announcements", depth: 0 },
  { id: "uiux", label: "UI/UX", depth: 0, count: 2 },
];

const INITIAL_POSTS: ChatPost[] = [
  {
    id: "p1",
    author: "Andrew Miller",
    when: "2d ago",
    body: "Hey team, I wanted to discuss the custom UI-kit we're developing for the site redesign. We need to finalize some components and make key design decisions to ensure consistency across the board. Let's make sure we cover colors, typography, buttons, and any other essential UI elements. @UX/UI @Sophia",
    reactions: [{ emoji: "✌️", count: 2 }],
  },
  {
    id: "p2",
    author: "Diana Taylor",
    when: "2d ago",
    body: "I have already prepared all styles and components according to our standards during the design phase, so the UI kit is 90% complete. All that remains is to add some states to the interactive elements and prepare the Lottie files for animations. @Emily D., please take a look and let me know if you have any questions.",
    linkCard: { title: "Conceptzilla website v.3.0", url: "www.figma.com" },
    reactions: [{ emoji: "❤️", count: 1 }],
  },
  {
    id: "p3",
    author: "Daniel Anderson",
    when: "3h ago",
    body: "Okay, keep me updated. @Diana T. I also wanted to remind you to keep the layers organized.",
    reactions: [{ emoji: "💪", count: 2 }],
  },
];

/** Mock chat client state — channel tree, thread posts, info panel tab. */
export function useChatScene() {
  const [channel, setChannel] = useState("uikit");
  const [infoTab, setInfoTab] = useState("info");
  const [posts, setPosts] = useState<ChatPost[]>(INITIAL_POSTS);

  const send = (text: string) => {
    setPosts((current) => [...current, { id: `mock-${Date.now()}`, author: "You", when: "now", body: text }]);
  };

  return { channel, setChannel, infoTab, setInfoTab, posts, send, members: MEMBERS, channels: CHANNELS };
}
