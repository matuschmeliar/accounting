"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage } from "ai";
import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Eraser,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  MessageSquare,
  Paperclip,
  Sparkles,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onToggle: () => void;
};

const STORAGE_KEY = "accounting:chatHistory:v1";
const MAX_STORED_MESSAGES = 200;

// Vercel Hobby body limit je 4.5 MB. Base64 v JSON inflácia +33%, takže
// hrubý limit 3 MB na súbor je bezpečný. Pri prechode na Vercel Pro dvíhame.
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_FILES = 5;

const ACCEPTED_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "text/csv",
  "text/plain",
];
const ACCEPT_ATTR = ".pdf,.png,.jpg,.jpeg,.gif,.webp,.csv,.txt";

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
    // ignore
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function filesToFileList(files: File[]): FileList {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  return dt.files;
}

function fileIconFor(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime === "application/pdf") return FileText;
  if (mime === "text/csv" || mime.includes("spreadsheet")) return FileSpreadsheet;
  return FileText;
}

export function ChatPanel({ open, onToggle }: Props) {
  const pathname = usePathname();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [initialMessages] = useState<UIMessage[]>(() => loadStoredMessages());

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({ context: { path: pathname } }),
    }),
    messages: initialMessages,
  });

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  function clearHistory() {
    if (!window.confirm("Vymazať celú históriu chatu? Túto akciu nie je možné vrátiť.")) return;
    setMessages([]);
    setAttachments([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  function acceptFiles(incoming: File[]) {
    setUploadError(null);

    // Excel — výslovne odmietame (Anthropic nemá native parser, MVP rieši cez CSV)
    const xlsxRejected = incoming.filter(
      (f) =>
        f.name.toLowerCase().endsWith(".xlsx") ||
        f.name.toLowerCase().endsWith(".xls") ||
        f.type.includes("spreadsheetml")
    );
    if (xlsxRejected.length > 0) {
      setUploadError(
        `Excel zatiaľ nepodporujem. Otvor v Numbers/Excel-i, "Uložiť ako" → CSV, a pošli CSV namiesto: ${xlsxRejected
          .map((f) => f.name)
          .join(", ")}`
      );
      return;
    }

    // Veľkosť
    const tooLarge = incoming.filter((f) => f.size > MAX_FILE_BYTES);
    if (tooLarge.length > 0) {
      setUploadError(
        `Príliš veľké (limit ${formatBytes(MAX_FILE_BYTES)} per súbor — Vercel Hobby): ${tooLarge
          .map((f) => `${f.name} (${formatBytes(f.size)})`)
          .join(", ")}`
      );
      return;
    }

    // Typ — niektoré prehliadače dajú prázdny mime, treba fallback na extension
    const isAccepted = (f: File): boolean => {
      if (ACCEPTED_MIME.includes(f.type)) return true;
      const name = f.name.toLowerCase();
      if (name.endsWith(".pdf")) return true;
      if (name.endsWith(".csv")) return true;
      if (name.endsWith(".txt")) return true;
      if (/\.(png|jpe?g|gif|webp)$/.test(name)) return true;
      return false;
    };
    const unsupported = incoming.filter((f) => !isAccepted(f));
    if (unsupported.length > 0) {
      setUploadError(
        `Nepodporovaný typ: ${unsupported
          .map((f) => `${f.name} (${f.type || "?"})`)
          .join(
            ", "
          )}. Akceptujem PDF, obrázky (PNG/JPG/GIF/WebP), CSV a TXT.`
      );
      return;
    }

    // Počet
    if (attachments.length + incoming.length > MAX_FILES) {
      setUploadError(`Max ${MAX_FILES} súborov naraz.`);
      return;
    }

    setAttachments((prev) => [...prev, ...incoming]);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      acceptFiles(Array.from(e.target.files));
    }
    // Reset value aby user mohol vybrať ten istý súbor znova po removnutí
    e.target.value = "";
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
    setUploadError(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    if (!input.trim() && attachments.length === 0) return;

    const text =
      input.trim() ||
      (attachments.length === 1
        ? "Spracuj prosím tento dokument."
        : "Spracuj prosím tieto dokumenty.");

    if (attachments.length > 0) {
      sendMessage({ text, files: filesToFileList(attachments) });
    } else {
      sendMessage({ text });
    }

    setInput("");
    setAttachments([]);
    setUploadError(null);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (e.dataTransfer.files) {
      acceptFiles(Array.from(e.dataTransfer.files));
    }
  }

  const isLoading = status === "submitted" || status === "streaming";
  const hasMessages = messages.length > 0;
  const canSubmit =
    !isLoading && (input.trim().length > 0 || attachments.length > 0);

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
    <aside
      className="hidden md:flex w-[400px] shrink-0 flex-col border-l border-border bg-card relative"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-accent/20 border-2 border-dashed border-accent pointer-events-none">
          <div className="rounded-lg bg-card border border-border px-4 py-3 shadow-sm">
            <div className="font-serif text-[16px]">Pusti tu — pripojí sa do správy</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              PDF, obrázok, CSV. Max {formatBytes(MAX_FILE_BYTES)} per súbor.
            </div>
          </div>
        </div>
      )}

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
              : "Pýtaj sa, hľadaj v dátach, alebo pripoj faktúru (PDF/CSV)."}
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
            <SuggestionBtn
              text="📎 Pripoj PDF faktúru a ja ju zaeviduuj"
              onClick={() => fileInputRef.current?.click()}
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

      <form className="px-5 pb-5 pt-2" onSubmit={onSubmit}>
        {/* Attachments pills */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {attachments.map((file, i) => {
              const Icon = fileIconFor(file.type);
              return (
                <div
                  key={`${file.name}-${i}`}
                  className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 pl-2 pr-1 py-1 text-[11px] max-w-full"
                >
                  <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate max-w-[180px]" title={file.name}>
                    {file.name}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    {formatBytes(file.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    aria-label={`Odstrániť ${file.name}`}
                    className="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Error message */}
        {uploadError && (
          <div className="mb-2 rounded-md border border-amber-200 bg-amber-50/60 px-2.5 py-1.5 text-[11px] text-amber-800">
            {uploadError}
          </div>
        )}

        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            onChange={handleFileSelect}
            className="hidden"
            aria-hidden="true"
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Spýtaj sa AI účtovníka… alebo pripoj faktúru"
            className="w-full rounded-xl border border-border bg-card pl-10 pr-12 py-3 text-[13px] outline-none focus:border-foreground/30 placeholder:text-muted-foreground/60 transition-colors"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || attachments.length >= MAX_FILES}
            aria-label="Pripojiť súbor"
            title={`Pripoj PDF / obrázok / CSV (max ${formatBytes(MAX_FILE_BYTES)} per súbor, ${MAX_FILES} spolu)`}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <Paperclip className="h-3.5 w-3.5" />
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
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
              skryje · drag-drop OK
            </>
          ) : (
            <>⌘K skryje chat panel · drag-drop súborov OK</>
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
          <div className="space-y-1.5">
            {message.parts.map((part, i) => {
              if (part.type === "text") {
                return (
                  <div key={i} className="whitespace-pre-wrap leading-relaxed">
                    {part.text}
                  </div>
                );
              }
              if (part.type === "file") {
                const p = part as {
                  type: "file";
                  mediaType: string;
                  filename?: string;
                  url: string;
                };
                const Icon = fileIconFor(p.mediaType);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 rounded-md bg-background/10 px-2 py-1 text-[11px]"
                  >
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="font-medium truncate">
                      {p.filename ?? "súbor"}
                    </span>
                    <span className="text-background/60 shrink-0">
                      {p.mediaType.split("/")[1]?.toUpperCase() ?? "?"}
                    </span>
                  </div>
                );
              }
              return null;
            })}
          </div>
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
