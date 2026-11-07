import { describe, expect, it } from "vitest";

import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("quotes and escapes cells that contain CSV separators", () => {
    expect(toCsv([["Name", "Value"], ['Lamp, "Pro"', 12]])).toBe(
      'Name,Value\r\n"Lamp, ""Pro""",12',
    );
  });

  it("prevents spreadsheet formula execution from string cells", () => {
    expect(toCsv([["=1+1", "safe"], ["  @SUM(A1:A2)", -2]])).toBe(
      "'=1+1,safe\r\n'  @SUM(A1:A2),-2",
    );
  });
});
