import { calcRiskScore } from "@/lib/analytics";

describe("calcRiskScore", () => {
  it("computes DEL station reference score 133", () => {
    expect(calcRiskScore(11, 4, 30, 17)).toBe(133);
  });

  it("returns 0 when all categories are zero", () => {
    expect(calcRiskScore(0, 0, 0, 0)).toBe(0);
  });

  it("returns 4 for a single CAT-A incident weight", () => {
    expect(calcRiskScore(1, 0, 0, 0)).toBe(4);
  });

  it("returns 1 for a single CAT-D incident weight", () => {
    expect(calcRiskScore(0, 0, 0, 1)).toBe(1);
  });
});
