import { describe, expect, it } from "@jest/globals";
import { parseSse } from "../sse";

describe("parseSse", () => {
  it("legge gli eventi completi e tiene da parte quello spezzato", () => {
    const first = parseSse('data: {"type":"text","delta":"Ci"}\n\ndata: {"type":"te');
    expect(first.events).toEqual([{ type: "text", delta: "Ci" }]);
    const second = parseSse(`${first.rest}xt","delta":"ao"}\n\n`);
    expect(second.events).toEqual([{ type: "text", delta: "ao" }]);
    expect(second.rest).toBe("");
  });

  it("ignora gli eventi non validi", () => {
    expect(parseSse("data: {rotto\n\ndata: {\"type\":\"done\"}\n\n").events).toEqual([{ type: "done" }]);
  });
});
