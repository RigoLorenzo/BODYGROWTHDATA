import { describe, expect, it } from "@jest/globals";
import { STYLE_INFO, TRAINING_STYLES, isTrainingStyle } from "../training-style";

describe("stili di allenamento", () => {
  it("ogni stile spiega quando migliori e quattro indicatori", () => {
    for (const style of TRAINING_STYLES) {
      const info = STYLE_INFO[style];
      expect(info.value).toBe(style);
      expect(info.indicators).toHaveLength(4);
      expect(["riepilogo", "palestra", "corsa"]).toContain(info.fitnessTab);
    }
  });

  it("riconosce solo i valori validi", () => {
    expect(isTrainingStyle("RUNNING")).toBe(true);
    expect(isTrainingStyle("running")).toBe(false);
    expect(isTrainingStyle(null)).toBe(false);
  });
});
