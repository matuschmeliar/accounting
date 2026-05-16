"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage } from "ai";
import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Eraser,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onToggle: () => void;
};

const STORAGE_KEY = "accounting:chatHistory:v1";
const MAX_STORED_MESSAGES = 200; // hard cap proti rastúcemu localStorage

function loadStoredMessages(): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as UIMessage[];
  } catch {
    return [];
  }
}

function saveMessages(messages: UIMessage[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed =
      messages.length > MAX_STORED_MESSAGES
        ? messages.slice(-MAX_STORED_MESSAGES)
        : messages;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // quota exceeded / private mode — fail silently
  }
}

export function ChatPanel({ open, onToggle }: Props) {
  const pathname = usePathname();
  const [input, setInput] = useState("");

  // Load history once on mount (this useState initializer runs once per Chat instance).
  // Note: typeof window check guards SSR. ChatPanel is "use client" but RSC still
  // renders client components on server to generate initial HTML.
  const [initialMessages] = useState<UIMessage[]>(() => loadStoredMessages());

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({ context: { path: pathname } }),
    }),
    messages: initialMessages,
  });

  // Sync to localStorage on every message change (after streaming completes).
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  function clearHistory() {
    if (!window.confirm("Vymazať celú históriu chatu? Túto akciu nie je možné vrátiť.")) return;
    setMessages([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  const isLoading = status === "submitted" || status === "streaming";
  const hasMessages = messages.length > 0;

  if (!open) {
    return (
      <aside className="hidden md:flex w-12 shrink-0 flex-col items-center gap-2 border-l border-border bg-card py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Otvoriť chat"
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Otvoriť chat (Cmd+K)"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="rounded-md p-2 text-muted-foreground/60">
          <MessageSquare className="h-4 w-4" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden md:flex w-[400px] shrink-0 flex-col border-l border-border bg-card">
      <header className="flex items-start justify-between px-5 pt-5 pb-3 gap-2">
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-[20px] font-medium leading-tight">
            AI účtovník
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {hasMessages
              ? `${messages.length} ${
                  messages.length === 1 ? "správa" : "správ"
                } · história uložená v prehliadači`
              : "Pýtaj sa, hľadaj v dátach, vytváraj záznamy hlasom."}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {hasMessages && (
            <button
              type="button"
              onClick={clearHistory}
              aria-label="Vymazať históriu"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Vymazať históriu chatu"
            >
              <Eraser className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            aria-label="Zatvoriť chat"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Zatvoriť (Cmd+K)"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-2 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3 mt-2">
            <SuggestionBtn
              text="Ukáž neuhradené faktúry"
              onClick={() => sendMessage({ text: "Ukáž neuhradené faktúry" })}
            />
            <SuggestionBtn
              text="Vystav FV za 10h × 80 € klientovi ACME s DPH 23%"
              onClick={() =>
                sendMessage({
                  text: "Vystav FV za 10h × 80 € klientovi ACME s DPH 23%",
                })
              }
            />
            <SuggestionBtn
              text="Spočítaj DPH za aktuálny mesiac"
              onClick={() =>
                sendMessage({ text: "Spočítaj DPH za aktuálny mesiac" })
              }
            />
          </div>
        )}

        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground italic">
            <Sparkles className="h-3 w-3 animate-pulse" />
            premýšľam…
          </div>
        )}
      </div>

      <form
        className="px-5 pb-5 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || isLoading) return;
          sendMessage({ text: input });
          setInput("");
        }}
      >
        <div className="relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Spýtaj sa AI účtovníka…"
            className="w-full rounded-xl border border-border bg-card pl-4 pr-12 py-3 text-[13px] outline-none focus:border-foreground/30 placeholder:text-muted-foreground/60 transition-colors"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            aria-label="Pošli"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg bg-foreground p-2 text-background disabled:opacity-30 hover:bg-foreground/90 transition-colors"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-2 text-[10px] text-muted-foreground/60 px-1">
          {pathname && pathname !== "/" ? (
            <>
              Kontext: <code className="font-mono">{pathname}</code> · ⌘K
              skryje
            </>
          ) : (
            <>⌘K skryje chat panel</>
          )}
        </div>
      </form>
    </aside>
  );
}

function SuggestionBtn({
  text,
  onClick,
}: {
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg border border-border bg-card hover:bg-muted/60 transition-colors px-3.5 py-2.5 text-[13px] text-foreground/80"
    >
      {text}
    </button>
  );
}

type UIMsg = ReturnType<typeof useChat>["messages"][number];

function ChatMessage({ message }: { message: UIMsg }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-foreground text-background px-3.5 py-2 text-[13px]">
          {message.parts.map((part, i) => {
            if (part.type === "text") {
              return (
                <div key={i} className="whitespace-pre-wrap leading-relaxed">
                  {part.text}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="h-6 w-6 shrink-0 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-[10px] font-medium">
        AI
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="text-[11px] font-medium text-muted-foreground">
          AI účtovník
          <span className="ml-1.5 text-muted-foreground/60 font-normal">
            pred chvíľou
          </span>
        </div>
        <div className="text-[13px] text-foreground/90 leading-relaxed space-y-2">
          {message.parts.map((part, i) => {
            if (part.type === "text") {
              return (
                <div key={i} className="whitespace-pre-wrap">
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
              const stateLabel =
                p.state === "output-available"
                  ? "hotové"
                  : p.state === "input-available"
                  ? "spúšťam"
                  : p.state ?? "";
              return (
                <details
                  key={i}
                  className={cn(
                    "rounded-lg border border-border bg-muted/40 text-[11px]",
                    "px-2.5 py-1.5"
                  )}
                >
                  <summary className="cursor-pointer font-mono text-muted-foreground flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span className="text-foreground/80">{toolName}</span>
                    {stateLabel && (
                      <span className="text-muted-foreground/70">
                        · {stateLabel}
                      </span>
                    )}
                  </summary>
                  {p.input != null && (
                    <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">
                      {JSON.stringify(p.input, null, 2)}
                    </pre>
                  )}
                  {p.output != null && (
                    <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-all text-[10px] text-muted-foreground">
                      {JSON.stringify(p.output, null, 2).slice(0, 1500)}
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
