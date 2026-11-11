"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseSse } from "@/lib/coach/sse";
import type { CoachEvent, DisplayMessage, ProposalView, ThreadSummary } from "@/lib/coach/types";

export const COACH_THREADS_KEY = ["coach", "threads"] as const;

interface ThreadResponse {
  id: string;
  title: string | null;
  messages: DisplayMessage[];
  proposals: ProposalView[];
}

type AssistantMessage = Extract<DisplayMessage, { role: "assistant" }>;

export interface ActiveTool {
  name: string;
  label: string;
}

export function useCoachThreads() {
  return useQuery<ThreadSummary[]>({
    queryKey: COACH_THREADS_KEY,
    queryFn: async () => {
      const res = await fetch("/api/coach/threads");
      if (!res.ok) throw new Error("threads");
      return res.json();
    },
  });
}

const tempId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Stato della chat con il Coach: carica la conversazione, invia i messaggi e
 * mostra la risposta mentre arriva (testo, tool in corso, domande, proposte).
 */
export function useCoachChat(threadId: string | null, onThreadCreated: (id: string) => void) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [proposals, setProposals] = useState<Record<string, ProposalView>>({});
  const [activeTools, setActiveTools] = useState<ActiveTool[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mentre arriva una risposta, il caricamento della conversazione non deve sovrascriverla
  const streamingRef = useRef(false);
  const currentThread = useRef(threadId);

  const thread = useQuery<ThreadResponse>({
    queryKey: ["coach", "thread", threadId],
    enabled: Boolean(threadId),
    queryFn: async () => {
      const res = await fetch(`/api/coach/threads/${threadId}`);
      if (!res.ok) throw new Error("thread");
      return res.json();
    },
  });

  useEffect(() => {
    currentThread.current = threadId;
    if (!threadId && !streamingRef.current) {
      setMessages([]);
      setProposals({});
    }
  }, [threadId]);

  useEffect(() => {
    if (!thread.data || streamingRef.current) return;
    setMessages(thread.data.messages);
    setProposals(Object.fromEntries(thread.data.proposals.map((p) => [p.id, p])));
  }, [thread.data]);

  const updateAssistant = useCallback((id: string, update: (m: AssistantMessage) => AssistantMessage) => {
    setMessages((list) => list.map((m) => (m.id === id && m.role === "assistant" ? update(m) : m)));
  }, []);

  const handleEvent = useCallback(
    (event: CoachEvent, assistantId: string) => {
      switch (event.type) {
        case "thread":
          if (event.threadId !== currentThread.current) {
            currentThread.current = event.threadId;
            onThreadCreated(event.threadId);
          }
          break;
        case "text":
          setActiveTools([]);
          updateAssistant(assistantId, (m) => ({ ...m, text: m.text + event.delta }));
          break;
        case "tool":
          if (event.status === "start") {
            setActiveTools((tools) => [...tools.filter((t) => t.name !== event.name), { name: event.name, label: event.label }]);
            updateAssistant(assistantId, (m) => (m.tools.includes(event.name) ? m : { ...m, tools: [...m.tools, event.name] }));
          } else {
            setActiveTools((tools) => tools.filter((t) => t.name !== event.name));
          }
          break;
        case "ask_user":
          updateAssistant(assistantId, (m) => ({ ...m, questions: event.questions }));
          break;
        case "proposal":
          setProposals((all) => ({ ...all, [event.proposal.id]: event.proposal }));
          updateAssistant(assistantId, (m) => ({ ...m, proposalIds: [...m.proposalIds, event.proposal.id] }));
          break;
        case "memory":
          break;
        case "error":
          setError(event.message);
          break;
        case "done":
          break;
      }
    },
    [onThreadCreated, updateAssistant]
  );

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || streamingRef.current) return;
      const assistantId = tempId();
      setError(null);
      setMessages((list) => [
        ...list,
        { id: tempId(), role: "user", text: clean },
        { id: assistantId, role: "assistant", text: "", tools: [], questions: null, proposalIds: [] },
      ]);
      streamingRef.current = true;
      setStreaming(true);

      try {
        const res = await fetch("/api/coach/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId: currentThread.current, text: clean }),
        });
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Il Coach non risponde. Riprova.");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const parsed = parseSse(buffer + decoder.decode(value, { stream: true }));
          buffer = parsed.rest;
          parsed.events.forEach((event) => handleEvent(event, assistantId));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Connessione interrotta. Riprova.");
      } finally {
        streamingRef.current = false;
        setStreaming(false);
        setActiveTools([]);
        queryClient.invalidateQueries({ queryKey: COACH_THREADS_KEY });
        // Si riallinea con il server (id veri dei messaggi, proposte salvate)
        if (currentThread.current) queryClient.invalidateQueries({ queryKey: ["coach", "thread", currentThread.current] });
      }
    },
    [handleEvent, queryClient]
  );

  const setProposal = useCallback((proposal: ProposalView) => {
    setProposals((all) => ({ ...all, [proposal.id]: proposal }));
  }, []);

  return {
    messages,
    proposals,
    activeTools,
    streaming,
    error,
    loading: Boolean(threadId) && thread.isPending && messages.length === 0,
    send,
    setProposal,
  };
}
