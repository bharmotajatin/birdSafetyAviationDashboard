import { uploadStatCards } from "@/lib/upload-stats";

const val = (cards: { label: string; value: string }[], label: string) => cards.find((c) => c.label === label)?.value;

describe("uploadStatCards", () => {
  it("counts incidents and distinct known stations from the stored sheet", () => {
    const stations = [...Array(31).fill("BLR"), ...Array(29).fill("COK"), ...Array(23).fill("DEL"), ...Array(6).fill("MAA"), ...Array(4).fill("TRV"), ...Array(3).fill("HYD")];
    const cards = uploadStatCards(stations.map((station) => ({ station })));
    expect(val(cards, "Incidents Tracked")).toBe("96");
    expect(val(cards, "Stations Monitored")).toBe("6");
  });
  it("ignores blank and Unknown stations", () => {
    const cards = uploadStatCards([{ station: "BLR" }, { station: "Unknown" }, { station: "" }]);
    expect(val(cards, "Incidents Tracked")).toBe("3");
    expect(val(cards, "Stations Monitored")).toBe("1");
  });
  it("shows a dash when no sheet is loaded", () => {
    expect(val(uploadStatCards(undefined), "Incidents Tracked")).toBe("\u2014");
  });
});
