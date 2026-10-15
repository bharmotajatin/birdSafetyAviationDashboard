import fs from "fs";
import path from "path";
import { parseIncidentLog, ensureUniqueIncidentIds } from "../../parse/incidents";
import { readWorkbookMatrices } from "../../parse/utils";
import type { Incident } from "../../types";
import { matchesLinkFilters } from "../../incident-links";
import { categoryCounts, daysBetween, normalizeId, openAge, parseHour, repeats, reportingDelay, timeOfDay } from "..";

const ROOT = path.resolve(__dirname, "../../../..");
const SHEET = process.env.PA12_SHEET ?? path.join(ROOT, ".local", "incident-log.xlsx");
const haveSheet = fs.existsSync(SHEET);

describe("helpers", () => {
  it("parses times and never turns an unreadable time into 00:00", () => {
    expect(parseHour("2350 hrs")).toBe(23);
    expect(parseHour("0950 Hrs")).toBe(9);
    expect(parseHour("23:50")).toBe(23);
    expect(parseHour("11:30 PM")).toBe(23);
    expect(parseHour("12:10 am")).toBe(0);
    expect(parseHour("0.5")).toBe(12);
    expect(parseHour("")).toBeNull();
    expect(parseHour("night")).toBeNull();
    expect(parseHour("2575")).toBeNull();
  });
  it("normalises ids with 01 = 1", () => {
    expect(normalizeId("TUG-01")).toBe(normalizeId("tug 1"));
    expect(normalizeId("NIL")).toBe("");
  });
  it("counts days between IST calendar days", () => {
    expect(daysBetween("2026-01-14", "2026-10-15")).toBe(274);
  });
  it("puts a report date before the incident date in its own bucket, not negative days", () => {
    const inc = { ghrNumber: "X1", station: "DEL", date: new Date("2026-03-09T18:30:00Z"), reportDate: "2026-03-08" } as unknown as Incident;
    const r = reportingDelay([inc]);
    expect(r.buckets.find((b) => b.label === "Report before incident")!.count).toBe(1);
    expect(r.avg).toBe(0);
  });
});

(haveSheet ? describe : describe.skip)("analyses on Jatin's sheet", () => {
  const buf = haveSheet ? fs.readFileSync(SHEET) : Buffer.alloc(0);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  const incidents = haveSheet ? ensureUniqueIncidentIds(parseIncidentLog(readWorkbookMatrices(ab))) : [];
  const sum = (b: { count: number }[]) => b.reduce((s, x) => s + x.count, 0);
  const linked = (ghrs: string[]) => !ghrs.length ? 0 : incidents.filter((i) => matchesLinkFilters(i, { ghr: ghrs.join(",") })).length;

  it("keeps the known totals", () => {
    expect(incidents).toHaveLength(96);
    expect(incidents.filter((i) => i.status === "Closed")).toHaveLength(80);
    const st = (s: string) => incidents.filter((i) => i.station === s).length;
    expect([st("BLR"), st("COK"), st("DEL"), st("MAA"), st("TRV"), st("HYD")]).toEqual([31, 29, 23, 6, 4, 3]);
  });

  it("reporting delay", () => {
    const r = reportingDelay(incidents);
    const c = Object.fromEntries(r.buckets.map((b) => [b.label, b.count]));
    expect(sum(r.buckets)).toBe(96);
    expect([c["Same day"], c["1-2 days"], c["3-7 days"], c["Over 7 days"]]).toEqual([93, 2, 1, 0]);
    expect(r.avg.toFixed(2)).toBe("0.07");
    expect(r.slowest!.station).toBe("BLR");
    expect(r.slowest!.avg.toFixed(2)).toBe("0.16");
    for (const b of r.buckets) expect(linked(b.ghrs)).toBe(b.count);
  });

  it("time of day", () => {
    const t = timeOfDay(incidents);
    const c = Object.fromEntries(t.buckets.map((b) => [b.label, b.count]));
    expect(sum(t.buckets)).toBe(96);
    expect([c["Night 00-06"], c["Morning 06-12"], c["Afternoon 12-18"], c["Evening 18-24"], c["Time not readable"]]).toEqual([35, 26, 15, 20, 0]);
    expect(Math.round(t.nightShare * 100)).toBe(36);
    for (const b of t.buckets) expect(linked(b.ghrs)).toBe(b.count);
  });

  it("open incident age on 15 Oct 2026", () => {
    const o = openAge(incidents, "2026-10-15");
    const c = Object.fromEntries(o.bands.map((b) => [b.label, b.count]));
    expect(o.total).toBe(16);
    expect(sum(o.bands)).toBe(16);
    expect([c["0-30 days"], c["31-90 days"], c["91-180 days"], c["Over 180 days"]]).toEqual([0, 6, 9, 1]);
    expect(o.oldest).toBe(273);
    expect(o.youngest).toBe(46);
    expect(o.over90).toBe(10);
    for (const b of o.bands) expect(linked(b.ghrs)).toBe(b.count);
  });

  it("category table puts NIL and blank under Not set and totals 96", () => {
    const c = categoryCounts(incidents);
    expect(c.find((x) => x.label === "Not set")!.count).toBe(4);
    expect(c.reduce((s, x) => s + x.count, 0)).toBe(96);
    for (const x of c) expect(linked(x.ghrs)).toBe(x.count);
  });

  it("repeats match type + station + number", () => {
    const r = repeats(incidents);
    expect(r.staff).toHaveLength(2);
    expect(r.equipment.map((g) => g.count)).toEqual([3, 2, 2, 2]);
    expect(r.bareNumberGroups).toBeGreaterThan(r.equipment.length);
  });
});
