"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./sidebar";
import { ChatPanel } from "./chat-panel";

const STORAGE_KEY = "chatPanelOpen";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [chatOpen, setChatOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "false") setChatOpen(false);
  }, []);

  function toggleChat() {
    setChatOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore (private mode, quota, etc.)
      }
      return next;
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleChat();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-zinc-50">{children}</main>
      {mounted && <ChatPanel open={chatOpen} onToggle={toggleChat} />}
    </div>
  );
}
