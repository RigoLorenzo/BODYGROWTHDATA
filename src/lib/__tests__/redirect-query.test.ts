import { describe, expect, it } from "@jest/globals";
import { toQuery } from "../redirect-query";

describe("query dei reindirizzamenti", () => {
  it("conserva i parametri e applica le sostituzioni", () => {
    expect(toQuery({ periodo: "year", del: "2025-01-01" }, { tab: "corsa" })).toBe("?periodo=year&del=2025-01-01&tab=corsa");
    expect(toQuery({ tab: "volume", x: ["a", "b"] })).toBe("?tab=volume&x=a&x=b");
    expect(toQuery({})).toBe("");
  });
});
