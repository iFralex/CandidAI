import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanSelector } from "@/components/PlanSelector";
import { plansInfo } from "@/config";

// Mock framer-motion to avoid animation issues in jsdom
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

describe("PlanSelector", () => {
  describe("rendering all 4 plans", () => {
    it("renders all 4 plans when excludeFree is false", () => {
      render(<PlanSelector excludeFree={false} />);

      expect(screen.getByText("Free Trial")).toBeInTheDocument();
      expect(screen.getByText("Base")).toBeInTheDocument();
      expect(screen.getByText("Pro")).toBeInTheDocument();
      expect(screen.getByText("Ultra")).toBeInTheDocument();
    });

    it("excludes free_trial by default (excludeFree defaults to true)", () => {
      render(<PlanSelector />);

      expect(screen.queryByText("Free Trial")).not.toBeInTheDocument();
      expect(screen.getByText("Base")).toBeInTheDocument();
      expect(screen.getByText("Pro")).toBeInTheDocument();
      expect(screen.getByText("Ultra")).toBeInTheDocument();
    });
  });

  describe("each plan shows name, price, and features", () => {
    it("shows plan names for all 4 plans", () => {
      render(<PlanSelector excludeFree={false} />);

      for (const plan of plansInfo) {
        expect(screen.getByText(plan.name)).toBeInTheDocument();
      }
    });

    it("shows base plan price as €30.00", () => {
      render(<PlanSelector />);
      expect(screen.getByText("€30.00")).toBeInTheDocument();
    });

    it("shows pro plan price as €69.00", () => {
      render(<PlanSelector />);
      expect(screen.getByText("€69.00")).toBeInTheDocument();
    });

    it("shows ultra plan price as €139.00", () => {
      render(<PlanSelector />);
      expect(screen.getByText("€139.00")).toBeInTheDocument();
    });

    it("shows maxCompanies in the features list for base plan (20 companies maximum)", () => {
      render(<PlanSelector />);
      expect(screen.getByText("20 companies maximum")).toBeInTheDocument();
    });

    it("shows maxCompanies in the features list for pro plan (50 companies maximum)", () => {
      render(<PlanSelector />);
      expect(screen.getByText("50 companies maximum")).toBeInTheDocument();
    });

    it("shows maxCompanies in the features list for ultra plan (100 companies maximum)", () => {
      render(<PlanSelector />);
      expect(screen.getByText("100 companies maximum")).toBeInTheDocument();
    });
  });

  describe("clicking a plan calls onSelect", () => {
    it("calls onSelect with the base plan object when clicking the Base plan card", async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      render(<PlanSelector onSelect={onSelect} />);

      const basePlan = plansInfo.find((p) => p.id === "base")!;
      await user.click(screen.getByText("Base").closest("[class*='cursor-pointer']")!);

      expect(onSelect).toHaveBeenCalledWith(basePlan);
    });

    it("calls onSelect with the pro plan object when clicking the Pro plan card", async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      render(<PlanSelector onSelect={onSelect} />);

      const proPlan = plansInfo.find((p) => p.id === "pro")!;
      await user.click(screen.getByText("Pro").closest("[class*='cursor-pointer']")!);

      expect(onSelect).toHaveBeenCalledWith(proPlan);
    });

    it("calls onSelect with the ultra plan object when clicking the Ultra plan card", async () => {
      const onSelect = vi.fn();
      const user = userEvent.setup();
      render(<PlanSelector onSelect={onSelect} />);

      const ultraPlan = plansInfo.find((p) => p.id === "ultra")!;
      await user.click(screen.getByText("Ultra").closest("[class*='cursor-pointer']")!);

      expect(onSelect).toHaveBeenCalledWith(ultraPlan);
    });

    it("calls onCtaClick (not onSelect) when onCtaClick is provided and the CTA button is clicked", async () => {
      const onSelect = vi.fn();
      const onCtaClick = vi.fn();
      const user = userEvent.setup();
      render(<PlanSelector onSelect={onSelect} onCtaClick={onCtaClick} />);

      const proPlan = plansInfo.find((p) => p.id === "pro")!;
      const buttons = screen.getAllByRole("button");
      // Click the first button (Base plan's Select Plan button)
      await user.click(buttons[0]);

      expect(onCtaClick).toHaveBeenCalled();
      // onSelect should NOT be called when onCtaClick is provided (button click)
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("selected plan visual indicator", () => {
    it("selected plan has ring-violet-500 and bg-violet-500/10 CSS classes", () => {
      const { container } = render(
        <PlanSelector selectedPlanId="pro" />
      );

      const selectedCard = container.querySelector(".ring-violet-500.bg-violet-500\\/10");
      expect(selectedCard).not.toBeNull();
    });

    it("only the selected plan has the active class combination", () => {
      const { container } = render(
        <PlanSelector selectedPlanId="base" />
      );

      const activeCards = container.querySelectorAll(".ring-violet-500.bg-violet-500\\/10");
      expect(activeCards).toHaveLength(1);
    });

    it("updating selectedPlanId changes which card has the active indicator", () => {
      const { rerender, container } = render(
        <PlanSelector selectedPlanId="base" />
      );

      let activeCards = container.querySelectorAll(".ring-violet-500.bg-violet-500\\/10");
      expect(activeCards).toHaveLength(1);

      // Switch to ultra selected
      rerender(<PlanSelector selectedPlanId="ultra" />);

      activeCards = container.querySelectorAll(".ring-violet-500.bg-violet-500\\/10");
      expect(activeCards).toHaveLength(1);

      // Ultra label should be inside the selected card
      const ultraLabel = screen.getByText("Ultra");
      expect(ultraLabel.closest(".bg-violet-500\\/10")).not.toBeNull();

      // Base label should NOT be inside the selected card
      const baseLabel = screen.getByText("Base");
      expect(baseLabel.closest(".bg-violet-500\\/10")).toBeNull();
    });

    it("no plan has the active indicator when selectedPlanId is undefined", () => {
      const { container } = render(<PlanSelector />);

      const activeCards = container.querySelectorAll(".ring-violet-500.bg-violet-500\\/10");
      expect(activeCards).toHaveLength(0);
    });
  });

  describe("free trial price display", () => {
    it('free trial plan shows "Free" instead of a monetary price', () => {
      render(<PlanSelector excludeFree={false} />);

      // The free plan shows "Free" in green
      expect(screen.getByText("Free")).toBeInTheDocument();
    });

    it("free trial does not show a euro price", () => {
      render(<PlanSelector excludeFree={false} />);

      // No €0.00 should be shown for free trial – "Free" is shown instead
      expect(screen.queryByText("€0.00")).not.toBeInTheDocument();
    });
  });

  describe("CTA button label", () => {
    it('shows "Select Plan" on buttons by default', () => {
      render(<PlanSelector />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((btn) => {
        expect(btn).toHaveTextContent("Select Plan");
      });
    });

    it("shows custom ctaLabel on all plan buttons when provided", () => {
      render(<PlanSelector ctaLabel="Buy Now" />);

      const buttons = screen.getAllByRole("button");
      buttons.forEach((btn) => {
        expect(btn).toHaveTextContent("Buy Now");
      });
    });
  });
});
