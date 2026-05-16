"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ChevronLeft, ChevronRight, MessageSquare, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onToggle: () => void;
};

export function ChatPanel({ open, onToggle }: Props) {
  const pathname = usePathname();
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({ context: { path: pathname } }),
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  if (!open) {
    return (
      <aside className="hidden md:flex w-12 shrink-0 flex-col items-center gap-2 border-l border-zinc-200 bg-white py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Otvoriť chat"
          className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100"
          title="Otvoriť chat (Cmd+K)"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="rounded-md p-2 text-zinc-400">
          <MessageSquare className="h-5 w-5" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden md:flex w-96 shrink-0 flex-col border-l border-zinc-200 bg-white">
      <header className="flex items-center justify-between border-b border-zinc-200 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-zinc-600" />
          <span className="text-sm font-medium">AI účtovník</span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Zatvoriť chat"
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100"
          title="Zatvoriť chat"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="rounded-md border border-dashed border-zinc-300 p-3 text-xs text-zinc-600">
            <p className="font-medium text-zinc-900">Ahoj!</p>
            <p className="mt-1">
              Pýtaj sa, alebo vytváraj záznamy hlasom. Skús napr.:
            </p>
            <ul className="mt-2 list-disc pl-4 space-y-0.5">
              <li>&ldquo;Ukáž neuhradené faktúry&rdquo;</li>
              <li>&ldquo;Vystav FV za 10h × 80 € klientovi ACME&rdquo;</li>
              <li>&ldquo;Spočítaj DPH za apríl&rdquo;</li>
            </ul>
          </div>
        )}

        <div className="space-y-3 mt-2">
          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} />
          ))}
          {isLoading && (
            <div className="text-xs text-zinc-400 italic">premýšľam…</div>
          )}
        </div>
      </div>

      <form
        className="border-t border-zinc-200 p-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || isLoading) return;
          sendMessage({ text: input });
          setInput("");
        }}
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Napíš správu…"
            className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
            disabled={isLoading}
          />
          <Button type="submit" size="sm" disabled={isLoading || !input.trim()}>
            Pošli
          </Button>
        </div>
      </form>
    </aside>
  );
}

type UIMsg = ReturnType<typeof useChat>["messages"][number];

function ChatMessage({ message }: { message: UIMsg }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[90%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-zinc-900 text-white"
            : "bg-zinc-100 text-zinc-900 border border-zinc-200"
        )}
      >
        <div className="space-y-2">
          {message.parts.map((part, i) => {
            if (part.type === "text") {
              return (
                <div key={i} className="whitespace-pre-wrap leading-relaxed">
                  {part.text}
                </div>
              );
            }
            if (part.type.startsWith("tool-")) {
              const toolName = part.type.replace("tool-", "");
              const p = part as unknown as {
                state?: string;
                input?: unknown;
                output?: unknown;
              };
              return (
                <details
                  key={i}
                  className="rounded border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600"
                >
                  <summary className="cursor-pointer font-mono">
                    🔧 {toolName}
                    {p.state ? ` · ${p.state}` : ""}
                  </summary>
                  {p.input != null && (
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-[10px]">
                      {`→ ${JSON.stringify(p.input, null, 2)}`}
                    </pre>
                  )}
                  {p.output != null && (
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-[10px]">
                      {`← ${JSON.stringify(p.output, null, 2).slice(0, 1500)}`}
                    </pre>
                  )}
                </details>
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}
