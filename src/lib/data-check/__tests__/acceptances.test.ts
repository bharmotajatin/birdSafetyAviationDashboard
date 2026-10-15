import { partitionIssues, type CellAcceptance } from "@/lib/data-check";

const issue = (cell: string, row: number, col: string, value: string) => ({ cell, row, col, value });
const acc = (row: number, col: string, value: string): CellAcceptance => ({
  row,
  col,
  value,
  acceptedAt: "2026-10-15T08:00:00.000Z",
  acceptedBy: "Tester",
});

describe("accept as is", () => {
  it("moves an issue to accepted only while the cell still holds the accepted value", () => {
    const issues = [issue("AC12", 12, "AC", "NONE"), issue("AG74", 74, "AG", ""), issue("BB92", 92, "BB", "")];
    const { open, accepted } = partitionIssues(issues, [acc(12, "AC", "NONE"), acc(74, "AG", "")]);
    expect(open.map((i) => i.cell)).toEqual(["BB92"]);
    expect(accepted.map((i) => [i.cell, i.acceptance.acceptedBy])).toEqual([
      ["AC12", "Tester"],
      ["AG74", "Tester"],
    ]);
  });

  it("stops applying once the value changes", () => {
    // Accepted "NONE", but the cell now holds "NIL" → the issue is open again.
    const { open, accepted } = partitionIssues([issue("AC12", 12, "AC", "NIL")], [acc(12, "AC", "NONE")]);
    expect(open).toHaveLength(1);
    expect(accepted).toHaveLength(0);
  });
});