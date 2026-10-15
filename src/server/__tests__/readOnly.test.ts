/** @jest-environment node */
import type { Incident } from "@/lib/types";

const inc = (p: Partial<Incident>) => ({ ghrNumber: "X", personInvolved: "", staffNo: "", brief: "", title: "T", ...p }) as Incident;

describe("view-only mode", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    jest.resetModules();
  });

  it("is off unless the flag is 1", async () => {
    delete process.env.READ_ONLY;
    delete process.env.NEXT_PUBLIC_READ_ONLY;
    const { readOnlyBlock } = await import("../read-only");
    expect(readOnlyBlock()).toBeNull();
  });

  it("returns 403 when READ_ONLY=1", async () => {
    process.env.READ_ONLY = "1";
    const { readOnlyBlock } = await import("../read-only");
    expect(readOnlyBlock()?.status).toBe(403);
  });

  it("gives each distinct staff number a stable pseudonym and keeps blanks blank", async () => {
    const { maskIncidentsForView } = await import("../read-only");
    const out = maskIncidentsForView([
      inc({ staffNo: "BIRD0123" }),
      inc({ staffNo: "" }),
      inc({ staffNo: "bird 123" }),
      inc({ staffNo: "BIRD999" }),
      inc({ staffNo: "NIL" }),
    ]).map((i) => i.staffNo);
    expect(out).toEqual(["Staff #1", "", "Staff #1", "Staff #2", ""]);
    expect(out.join(" ")).not.toMatch(/BIRD|123|999/);
  });

  it("hides person and staff fields and redacts them from free text", async () => {
    const { maskIncidentsForView } = await import("../read-only");
    const [m] = maskIncidentsForView([
      inc({ personInvolved: "Arjun Mehra", staffNo: "BIRD12345", brief: "Driver Arjun Mehra (BIRD12345) was towing dollies at T2." }),
    ]);
    expect(m!.personInvolved).toBe("Hidden");
    expect(m!.staffNo).toBe("Staff #1");
    expect(m!.brief).not.toMatch(/Arjun|Mehra|BIRD12345/);
    expect(m!.brief).toContain("towing dollies at T2");
  });
});
