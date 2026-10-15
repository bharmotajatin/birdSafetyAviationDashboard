import { STATIONS } from "../../constants";
import { stationFromGhrNumber } from "../utils";

describe("stationFromGhrNumber", () => {
  it("takes a known station code from the GHR prefix", () => {
    expect(stationFromGhrNumber("BLR2026/27", STATIONS)).toBe("BLR");
    expect(stationFromGhrNumber("blr2026/32", STATIONS)).toBe("BLR");
    expect(stationFromGhrNumber(" DEL/2026/01", STATIONS)).toBe("DEL");
  });

  it("returns null for unknown codes, longer words or no prefix", () => {
    expect(stationFromGhrNumber("XYZ2026/1", STATIONS)).toBeNull();
    expect(stationFromGhrNumber("BLRX2026/1", STATIONS)).toBeNull();
    expect(stationFromGhrNumber("GHR-12", STATIONS)).toBeNull();
    expect(stationFromGhrNumber("2026/27", STATIONS)).toBeNull();
    expect(stationFromGhrNumber("", STATIONS)).toBeNull();
  });
});
