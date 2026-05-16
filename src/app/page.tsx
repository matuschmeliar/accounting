"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-screen flex-col bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white px-6 py-3">
        <h1 className="text-sm font-semibold">Účtovný AI · JARVIS Datamap</h1>
        <p className="text-xs text-zinc-500">MVP demo · claude-opus-4-7</p>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 && (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600">
              <p className="font-medium text-zinc-900">Ahoj, som tvoj AI účtovník.</p>
              <p className="mt-2">Skús niečo ako:</p>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li>&ldquo;Ukáž mi všetkých zákazníkov ktorých máme v databáze.&rdquo;</li>
                <li>&ldquo;Vytvor klienta Acme s.r.o. s IČ DPH SK2020123456.&rdquo;</li>
                <li>&ldquo;Vystav faktúru tomuto klientovi za 10 hodín konzultácie po 100 € + DPH 23%.&rdquo;</li>
                <li>&ldquo;Spočítaj DPH pre tieto sumy: 1000 € na 23%, 500 € na 19%.&rdquo;</li>
              </ul>
            </div>
          )}

          {messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}

          {isLoading && (
            <div className="text-xs text-zinc-500">premýšľam…</div>
          )}
        </div>
      </main>

      <form
        className="border-t border-zinc-200 bg-white px-6 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || isLoading) return;
          sendMessage({ text: input });
          setInput("");
        }}
      >
        <div className="mx-auto flex max-w-3xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Napíš správu… (Enter pošle)"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Pošli
          </button>
        </div>
      </form>
    </div>
  );
}

type UIMsg = ReturnType<typeof useChat>["messages"][number];

function Message({ message }: { message: UIMsg }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={[
          "max-w-[85%] rounded-lg px-4 py-3 text-sm",
          isUser
            ? "bg-zinc-900 text-white"
            : "bg-white text-zinc-900 border border-zinc-200",
        ].join(" ")}
      >
        <div className="space-y-2">
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
              return (
                <details
                  key={i}
                  className="rounded border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-xs text-zinc-700"
                >
                  <summary className="cursor-pointer font-mono">
                    🔧 {toolName} {p.state ? `· ${p.state}` : ""}
                  </summary>
                  {p.input != null && (
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all">
                      {`→ ${JSON.stringify(p.input, null, 2)}`}
                    </pre>
                  )}
                  {p.output != null && (
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all">
                      {`← ${JSON.stringify(p.output, null, 2).slice(0, 2000)}`}
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
