import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Modal } from "@/components/ui/modal";

const dialogMethods = ["showModal", "close"] as const;
const originalDialogMethods = new Map<string, PropertyDescriptor | undefined>();
const showModal = vi.fn(function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
});
const close = vi.fn(function (this: HTMLDialogElement) {
  this.removeAttribute("open");
});

beforeEach(() => {
  for (const method of dialogMethods) {
    originalDialogMethods.set(method, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, method));
  }
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: showModal,
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: close,
  });
});

afterEach(() => {
  for (const method of dialogMethods) {
    const descriptor = originalDialogMethods.get(method);
    if (descriptor) {
      Object.defineProperty(HTMLDialogElement.prototype, method, descriptor);
    } else {
      Reflect.deleteProperty(HTMLDialogElement.prototype, method);
    }
  }
  originalDialogMethods.clear();
  vi.clearAllMocks();
});

function ControlledModal() {
  const [open, setOpen] = useState(true);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Dialog title">
      <p>Dialog content</p>
    </Modal>
  );
}

describe("Modal", () => {
  it("opens as a native modal and closes when its close button is activated", () => {
    render(<ControlledModal />);

    const dialog = screen.getByRole("dialog", { name: "Dialog title" });
    expect(showModal).toHaveBeenCalledOnce();
    expect(dialog.getAttribute("open")).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Close modal" }));

    expect(close).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Dialog title" })).toBeNull();
  });
});
