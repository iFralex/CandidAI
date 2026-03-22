import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreditSelector } from "@/components/CreditSelector";

// Mock framer-motion to avoid animation issues in jsdom
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

const PACKAGES = [
  { id: "pkg_1000", credits: 1000, price: 1000 },
  { id: "pkg_2500", credits: 2500, price: 2000 },
  { id: "pkg_5000", credits: 5000, price: 3000 },
];

describe("CreditSelector", () => {
  it("renders exactly 3 credit packages (pkg_1000, pkg_2500, pkg_5000)", () => {
    render(<CreditSelector onSelect={vi.fn()} />);

    // Each package has a label: Starter, Popular, Power
    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("Popular")).toBeInTheDocument();
    expect(screen.getByText("Power")).toBeInTheDocument();
  });

  it("renders each card with name, credit amount, and price", () => {
    render(<CreditSelector onSelect={vi.fn()} />);

    // pkg_1000: Starter, 1,000 credits, €10.00
    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText(/1[.,]?000/)).toBeInTheDocument();
    expect(screen.getByText("€10.00")).toBeInTheDocument();

    // pkg_2500: Popular, 2,500 credits, €20.00
    expect(screen.getByText("Popular")).toBeInTheDocument();
    expect(screen.getByText(/2[.,]?500/)).toBeInTheDocument();
    expect(screen.getByText("€20.00")).toBeInTheDocument();

    // pkg_5000: Power, 5,000 credits, €30.00
    expect(screen.getByText("Power")).toBeInTheDocument();
    expect(screen.getByText(/5[.,]?000/)).toBeInTheDocument();
    expect(screen.getByText("€30.00")).toBeInTheDocument();
  });

  it("calls onSelect with pkg_1000 object when clicking Starter card", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<CreditSelector onSelect={onSelect} />);

    await user.click(screen.getByText("Starter").closest("[class*='cursor-pointer']")!);

    expect(onSelect).toHaveBeenCalledWith(PACKAGES[0]);
  });

  it("calls onSelect with pkg_2500 object when clicking Popular card", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<CreditSelector onSelect={onSelect} />);

    await user.click(screen.getByText("Popular").closest("[class*='cursor-pointer']")!);

    expect(onSelect).toHaveBeenCalledWith(PACKAGES[1]);
  });

  it("calls onSelect with pkg_5000 object when clicking Power card", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<CreditSelector onSelect={onSelect} />);

    await user.click(screen.getByText("Power").closest("[class*='cursor-pointer']")!);

    expect(onSelect).toHaveBeenCalledWith(PACKAGES[2]);
  });

  it("selected package receives active CSS classes (ring-violet-500)", () => {
    const { container } = render(
      <CreditSelector onSelect={vi.fn()} selectedId="pkg_1000" />
    );

    // The selected card should have the active ring classes
    const selectedCard = container.querySelector(".ring-violet-500.bg-violet-500\\/10");
    expect(selectedCard).not.toBeNull();
  });

  it("unselected packages do not have the active (ring-violet-500 bg-violet-500/10) class combination", () => {
    const { container } = render(
      <CreditSelector onSelect={vi.fn()} selectedId="pkg_1000" />
    );

    // Only 1 card should have both active classes
    const activeCards = container.querySelectorAll(".ring-violet-500.bg-violet-500\\/10");
    expect(activeCards).toHaveLength(1);
  });

  it("updating selectedId from pkg_1000 to pkg_5000 updates which card has active classes", () => {
    const { rerender, container } = render(
      <CreditSelector onSelect={vi.fn()} selectedId="pkg_1000" />
    );

    // Initially pkg_1000 is selected – 1 active card
    let activeCards = container.querySelectorAll(".ring-violet-500.bg-violet-500\\/10");
    expect(activeCards).toHaveLength(1);

    // Rerender with pkg_5000 selected
    rerender(<CreditSelector onSelect={vi.fn()} selectedId="pkg_5000" />);

    activeCards = container.querySelectorAll(".ring-violet-500.bg-violet-500\\/10");
    expect(activeCards).toHaveLength(1);

    // Verify the Power label is in the selected card
    const powerLabel = screen.getByText("Power");
    const powerCard = powerLabel.closest(".ring-violet-500");
    expect(powerCard).not.toBeNull();

    // Verify the Starter label is NOT in the selected card
    const starterLabel = screen.getByText("Starter");
    expect(starterLabel.closest(".bg-violet-500\\/10")).toBeNull();
  });
});
