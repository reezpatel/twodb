import { useState, type ReactNode } from "react";

export type ChatPost = {
	id: string;
	author: string;
	when: string;
	body: ReactNode;
	reactions?: { emoji: string; count: number }[];
	linkCard?: { title: string; url: string };
};

export function useChatScene(initialPosts: ChatPost[]) {
	const [channel, setChannel] = useState("uikit");
	const [infoTab, setInfoTab] = useState("info");
	const [posts, setPosts] = useState<ChatPost[]>(initialPosts);

	function send(text: string) {
		setPosts((current) => [
			...current,
			{
				id: `mock-${Date.now()}`,
				author: "You",
				when: "now",
				body: text,
			},
		]);
	}

	return { channel, setChannel, infoTab, setInfoTab, posts, send };
}
