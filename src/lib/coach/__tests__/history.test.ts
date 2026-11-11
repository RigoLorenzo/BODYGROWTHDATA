import { describe, expect, it } from "@jest/globals";
import { toApiMessages, toDisplay, type StoredMessage } from "../history";

let n = 0;
const m = (role: string, content: unknown): StoredMessage => ({ id: `m${++n}`, role, content });
const text = (t: string) => [{ type: "text", text: t }];
const toolUse = (id: string, name: string, input: unknown = {}) => ({ type: "tool_use", id, name, input });
const toolResult = (id: string, content: string) => ({ type: "tool_result", tool_use_id: id, content });

describe("toApiMessages", () => {
  it("mappa i ruoli salvati in quelli dell'API", () => {
    const out = toApiMessages([
      m("user", text("ciao")),
      m("system", "Oggi è martedì"),
      m("assistant", [toolUse("t1", "get_athlete_overview")]),
      m("tool", [toolResult("t1", "{}")]),
      m("assistant", text("Eccomi")),
    ]);
    expect(out.map((x) => x.role)).toEqual(["user", "system", "assistant", "user", "assistant"]);
    expect(out[1]).toMatchObject({ clear_at: "next_user_message" });
  });

  it("chiude i tool rimasti senza risultato dopo un errore", () => {
    const out = toApiMessages([
      m("user", text("ciao")),
      m("system", "ctx"),
      m("assistant", [toolUse("t1", "query_training_data")]),
      m("user", text("ci sei?")),
      m("system", "ctx"),
    ]);
    expect(out.map((x) => x.role)).toEqual(["user", "system", "assistant", "user", "user", "system"]);
    expect(out[3].content).toEqual([expect.objectContaining({ type: "tool_result", tool_use_id: "t1", is_error: true })]);
  });

  it("toglie un contesto di sistema rimasto senza risposta", () => {
    const out = toApiMessages([m("user", text("a")), m("system", "ctx"), m("user", text("b")), m("system", "ctx")]);
    expect(out.map((x) => x.role)).toEqual(["user", "user", "system"]);
  });
});

describe("toDisplay", () => {
  it("unisce i passaggi del Coach in un solo messaggio", () => {
    const items = toDisplay([
      m("user", text("Fammi un piano")),
      m("system", "ctx"),
      m("assistant", [{ type: "thinking", thinking: "" }, toolUse("t1", "get_athlete_overview")]),
      m("tool", [toolResult("t1", "{}")]),
      m("assistant", [toolUse("t2", "ask_user", { questions: [{ id: "giorni", question: "Quanti giorni?" }] })]),
      m("tool", [toolResult("t2", "{}")]),
      m("user", text("4")),
      m("assistant", [text("Ecco")[0], toolUse("t3", "propose_program")]),
      m("tool", [toolResult("t3", JSON.stringify({ proposalId: "p1" }))]),
      m("assistant", text("Guarda l'anteprima")),
    ]);
    expect(items.map((i) => i.role)).toEqual(["user", "assistant", "user", "assistant"]);
    const first = items[1] as Extract<(typeof items)[number], { role: "assistant" }>;
    expect(first.tools).toEqual(["get_athlete_overview", "ask_user"]);
    expect(first.questions).toHaveLength(1);
    const last = items[3] as Extract<(typeof items)[number], { role: "assistant" }>;
    expect(last.text).toBe("Ecco\n\nGuarda l'anteprima");
    expect(last.proposalIds).toEqual(["p1"]);
  });
});
