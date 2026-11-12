import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComingSoon } from "@/components/ComingSoon";

describe("ComingSoon", () => {
  it("renders a single page heading and clearly identifies the unavailable area", () => {
    render(<ComingSoon title="Orders" />);

    const main = screen.getByRole("main");
    expect(within(main).getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(within(main).getByRole("heading", { level: 1 }).textContent).toBe("Orders");
    expect(within(main).getByText("Coming soon. This area is not implemented in the mock demo.")).toBeTruthy();
  });
});
