"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, History, Loader2, Plus, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCoachChat, useCoachThreads } from "@/hooks/use-coach-chat";
import { cn } from "@/lib/utils";
import type { DisplayMessage } from "@/lib/coach/types";
import { CoachMarkdown } from "./markdown";
import { ProposalCard } from "./proposal-card";
import { QuestionCard } from "./question-card";

const SUGGESTIONS = [
  "Creami un piano di allenamento",
  "Come sta andando questo mese?",
  "Quante serie di petto ho fatto quest'anno?",
  "Com'è andata da quando uso l'app?",
];

const COACH_PATH = "/coach";

/** Il Coach: chat in streaming con domande, proposte di piano e storico conversazioni */
export function CoachChat({ initialThreadId }: { initialThreadId: string | null }) {
  const router = useRouter();
  const [threadId, setThreadId] = useState<string | null>(initialThreadId);
  const [historyOpen, setHistoryOpen] = useState(false);

  const selectThread = useCallback(
    (id: string | null) => {
      setThreadId(id);
      router.replace(id ? `${COACH_PATH}?t=${id}` : COACH_PATH, { scroll: false });
    },
    [router]
  );

  const chat = useCoachChat(threadId, selectThread);
  const threads = useCoachThreads();
  const endRef = useRef<HTMLDivElement>(null);
  const last = chat.messages[chat.messages.length - 1];
  const lastLength = last?.role === "assistant" ? last.text.length : 0;

  // Segue la risposta mentre arriva
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.messages.length, lastLength, chat.activeTools.length]);

  const lastAssistantId = [...chat.messages].reverse().find((m) => m.role === "assistant")?.id;
  const isLastMessage = (m: DisplayMessage) => chat.messages[chat.messages.length - 1]?.id === m.id;

  return (
    <div className="container mx-auto flex min-h-[calc(100dvh-5rem)] max-w-2xl flex-col px-4 pt-3 md:min-h-dvh">
      <header className="flex items-center justify-between gap-2 pb-3">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Coach</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            aria-label="Conversazioni precedenti"
            className="flex h-11 w-11 items-center justify-center rounded-full active:bg-muted"
          >
            <History className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => selectThread(null)}
            disabled={chat.streaming}
            aria-label="Nuova conversazione"
            className="flex h-11 w-11 items-center justify-center rounded-full active:bg-muted disabled:opacity-40"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-5 pb-4" aria-live="polite">
        {chat.loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Caricamento" />
          </div>
        )}

        {!chat.loading && chat.messages.length === 0 && <EmptyState onPick={chat.send} />}

        {chat.messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-foreground px-4 py-2.5 text-[15px] text-background">
                {m.text}
              </p>
            </div>
          ) : (
            <div key={m.id} className="text-[15px]">
              {m.text && <CoachMarkdown text={m.text} />}
              {chat.streaming && isLastMessage(m) && (
                <WorkingIndicator labels={chat.activeTools.map((t) => t.label)} hasText={Boolean(m.text)} />
              )}
              {m.questions && (
                <QuestionCard
                  questions={m.questions}
                  active={!chat.streaming && m.id === lastAssistantId && isLastMessage(m)}
                  onSubmit={chat.send}
                />
              )}
              {m.proposalIds.map((id) =>
                chat.proposals[id] ? <ProposalCard key={id} proposal={chat.proposals[id]} onChange={chat.setProposal} /> : null
              )}
            </div>
          )
        )}

        {chat.error && <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{chat.error}</p>}
        <div ref={endRef} />
      </div>

      <Composer disabled={chat.streaming} onSend={chat.send} />

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[80dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conversazioni</DialogTitle>
          </DialogHeader>
          {chat.streaming && <p className="text-sm text-muted-foreground">Attendi che il Coach finisca di rispondere.</p>}
          {threads.data?.length ? (
            <ul className="space-y-1">
              {threads.data.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    // Durante una risposta non si cambia conversazione: gli eventi finirebbero nell'altra
                    disabled={chat.streaming}
                    onClick={() => {
                      selectThread(t.id);
                      setHistoryOpen(false);
                    }}
                    className={cn(
                      "flex min-h-12 w-full flex-col items-start justify-center rounded-2xl px-3 py-2 text-left active:bg-muted disabled:opacity-50",
                      t.id === threadId && "bg-muted"
                    )}
                  >
                    <span className="line-clamp-1 font-medium">{t.title ?? "Conversazione"}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(t.lastMessageAt).toLocaleDateString("it-IT", { day: "numeric", month: "long" })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Ancora nessuna conversazione.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="space-y-5 pt-6">
      <div className="space-y-2">
        <Sparkles className="h-7 w-7 text-primary" aria-hidden />
        <p className="text-xl font-semibold">Ciao! Sono il tuo Coach.</p>
        <p className="text-sm text-muted-foreground">
          Conosco i tuoi allenamenti, le corse e il recupero. Chiedimi un piano, un&apos;analisi o qualsiasi numero.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="min-h-12 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-left text-sm font-medium active:scale-[0.99]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function WorkingIndicator({ labels, hasText }: { labels: string[]; hasText: boolean }) {
  if (hasText && labels.length === 0) return null;
  return (
    <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {labels.length > 0 ? `${labels[labels.length - 1]}…` : "Ci penso…"}
    </p>
  );
}

function Composer({ disabled, onSend }: { disabled: boolean; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const submit = () => {
    if (!text.trim() || disabled) return;
    onSend(text);
    setText("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] -mx-4 bg-background/95 px-4 pb-3 pt-2 backdrop-blur md:bottom-0"
    >
      <div className="flex items-end gap-2 rounded-3xl border border-border bg-muted/40 p-1.5 pl-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Scrivi al tuo Coach…"
          aria-label="Messaggio per il Coach"
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-base outline-none [field-sizing:content] md:text-sm"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          aria-label="Invia"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-30 active:scale-95"
        >
          {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
        </button>
      </div>
    </form>
  );
}
