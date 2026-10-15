import { canGoBack, fallbackParent, nextStack } from "@/lib/nav-history";

describe("nav history", () => {
  it("pushes new pages and pops when the previous page is visited (Back)", () => {
    let s: string[] = [];
    s = nextStack(s, "/overview");
    s = nextStack(s, "/station-wise?station=BLR");
    s = nextStack(s, "/incident-log?station=BLR");
    expect(s).toEqual(["/overview", "/station-wise?station=BLR", "/incident-log?station=BLR"]);
    s = nextStack(s, "/station-wise?station=BLR");
    expect(s).toEqual(["/overview", "/station-wise?station=BLR"]);
    expect(canGoBack(s)).toBe(true);
  });
  it("treats a reload as no change and a first visit as no history", () => {
    const s = nextStack(["/monthly"], "/monthly");
    expect(s).toEqual(["/monthly"]);
    expect(canGoBack(s)).toBe(false);
  });
  it("falls back to the section's first tab, then Overview, then home", () => {
    expect(fallbackParent("/trends/time-of-day", "/trends")).toBe("/trends");
    expect(fallbackParent("/station-wise", "/station-wise")).toBe("/overview");
    expect(fallbackParent("/overview", "/overview")).toBe("/");
  });
});
