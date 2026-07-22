import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// ---- Module mocks (must be hoisted before imports) ----

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(() => false),
}));

vi.mock("@/actions/onboarding-actions", () => ({
  addNewCompanies: vi.fn(),
  confirmCompany: vi.fn(),
}));

vi.mock("@/components/onboarding", () => ({
  CompanyAutocomplete: ({ onAddCompany, value, onChange, placeholder }: any) => (
    <div>
      <input
        data-testid="company-autocomplete"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search by company name or paste a LinkedIn URL..."}
      />
      <button
        data-testid="mock-add-company"
        type="button"
        onClick={() =>
          onAddCompany({ name: "Test Corp", domain: "testcorp.com", icon: null })
        }
      >
        Select Company
      </button>
    </div>
  ),
  AddStrategyButton: () => <div data-testid="add-strategy-button" />,
  AdvancedFiltersClient: () => <div data-testid="advanced-filters-client" />,
}));

vi.mock("@/app/dashboard/[id]/client", () => ({
  CreditsDialog: () => <div data-testid="credits-dialog" />,
}));

// ---- Imports (after mocks) ----

import { AddMoreCompaniesDialog } from "@/components/dashboard";
import * as onboardingActions from "@/actions/onboarding-actions";

// ---- Helpers ----

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /add more companies/i }));
}

async function addOneCompany(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("mock-add-company"));
}

async function clickAddButton(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /add 1 company/i }));
}

// ---- Tests ----

describe("AddMoreCompaniesDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dialog is closed by default", () => {
    it("does not render dialog content on initial mount", () => {
      render(<AddMoreCompaniesDialog />);
      expect(screen.queryByText("Add Target Companies")).not.toBeInTheDocument();
    });

    it("shows the 'Add More Companies' trigger button by default", () => {
      render(<AddMoreCompaniesDialog />);
      expect(
        screen.getByRole("button", { name: /add more companies/i })
      ).toBeInTheDocument();
    });
  });

  describe("clicking 'Add More Companies' opens the dialog", () => {
    it("shows the dialog title after clicking the trigger", async () => {
      const user = userEvent.setup();
      render(<AddMoreCompaniesDialog />);

      await openDialog(user);

      expect(screen.getByText("Add Target Companies")).toBeInTheDocument();
    });

    it("shows the dialog description after opening", async () => {
      const user = userEvent.setup();
      render(<AddMoreCompaniesDialog />);

      await openDialog(user);

      expect(
        screen.getByText(/search for companies to add to your campaign queue/i)
      ).toBeInTheDocument();
    });
  });

  describe("rendering the company form inside the dialog", () => {
    it("renders the company search autocomplete input", async () => {
      const user = userEvent.setup();
      render(<AddMoreCompaniesDialog />);

      await openDialog(user);

      expect(screen.getByTestId("company-autocomplete")).toBeInTheDocument();
    });

    it("renders the autocomplete with the correct placeholder", async () => {
      const user = userEvent.setup();
      render(<AddMoreCompaniesDialog />);

      await openDialog(user);

      expect(
        screen.getByPlaceholderText(/search by company name or paste a linkedin url/i)
      ).toBeInTheDocument();
    });

    it("shows 'No companies selected yet' when no company has been added", async () => {
      const user = userEvent.setup();
      render(<AddMoreCompaniesDialog />);

      await openDialog(user);

      expect(screen.getByText(/no companies selected yet/i)).toBeInTheDocument();
    });

    it("shows the Cancel button in the footer", async () => {
      const user = userEvent.setup();
      render(<AddMoreCompaniesDialog />);

      await openDialog(user);

      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe("submit with valid fields calls addNewCompanies action", () => {
    it("calls addNewCompanies when a company is selected and submit is clicked", async () => {
      vi.mocked(onboardingActions.addNewCompanies).mockResolvedValue({
        success: true,
      });
      const user = userEvent.setup();
      render(<AddMoreCompaniesDialog />);

      await openDialog(user);
      await addOneCompany(user);
      await clickAddButton(user);

      await waitFor(() => {
        expect(onboardingActions.addNewCompanies).toHaveBeenCalledOnce();
      });
    });

    it("passes the correct company data to addNewCompanies", async () => {
      vi.mocked(onboardingActions.addNewCompanies).mockResolvedValue({
        success: true,
      });
      const user = userEvent.setup();
      render(<AddMoreCompaniesDialog />);

      await openDialog(user);
      await addOneCompany(user);
      await clickAddButton(user);

      await waitFor(() => {
        expect(onboardingActions.addNewCompanies).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ name: "Test Corp", domain: "testcorp.com" }),
          ])
        );
      });
    });
  });

  describe("submit with invalid domain shows validation error", () => {
    it("shows the error message returned by the action for an invalid domain", async () => {
      vi.mocked(onboardingActions.addNewCompanies).mockResolvedValue({
        success: false,
        error: "Invalid domain provided",
      });
      const user = userEvent.setup();
      render(<AddMoreCompaniesDialog />);

      await openDialog(user);
      await addOneCompany(user);
      await clickAddButton(user);

      await waitFor(() => {
        expect(screen.getByText("Invalid domain provided")).toBeInTheDocument();
      });
    });
  });

  describe("submit with duplicate company (already in list) shows error", () => {
    it("shows error when action returns a duplicate company error", async () => {
      vi.mocked(onboardingActions.addNewCompanies).mockResolvedValue({
        success: false,
        error: "Company already exists in your campaign",
      });
      const user = userEvent.setup();
      render(<AddMoreCompaniesDialog />);

      await openDialog(user);
      await addOneCompany(user);
      await clickAddButton(user);

      await waitFor(() => {
        expect(
          screen.getByText("Company already exists in your campaign")
        ).toBeInTheDocument();
      });
    });

    it("does not add the same company twice to the selection list", async () => {
      const user = userEvent.setup();
      render(<AddMoreCompaniesDialog />);

      await openDialog(user);

      // Add the same company twice via the mock
      await user.click(screen.getByTestId("mock-add-company"));
      await user.click(screen.getByTestId("mock-add-company"));

      // Should still show "Add 1 Company" (not 2), since duplicate is ignored
      expect(screen.getByRole("button", { name: /add 1 company/i })).toBeInTheDocument();
    });
  });

  describe("submit exceeding plan limit shows 'Limit Reached' error", () => {
    it("shows the plan limit error returned by the action", async () => {
      vi.mocked(onboardingActions.addNewCompanies).mockResolvedValue({
        success: false,
        error: "Exceeds plan limit (10/10 used).",
      });
      const user = userEvent.setup();
      render(<AddMoreCompaniesDialog />);

      await openDialog(user);
      await addOneCompany(user);
      await clickAddButton(user);

      await waitFor(() => {
        expect(screen.getByText(/exceeds plan limit/i)).toBeInTheDocument();
      });
    });

    it("keeps the dialog open when the plan limit error occurs", async () => {
      vi.mocked(onboardingActions.addNewCompanies).mockResolvedValue({
        success: false,
        error: "Exceeds plan limit (5/5 used).",
      });
      const user = userEvent.setup();
      render(<AddMoreCompaniesDialog />);

      await openDialog(user);
      await addOneCompany(user);
      await clickAddButton(user);

      await waitFor(() => {
        expect(screen.getByText(/exceeds plan limit/i)).toBeInTheDocument();
      });
      // Dialog title should still be visible
      expect(screen.getByText("Add Target Companies")).toBeInTheDocument();
    });
  });

  describe("success closes the dialog and updates the list", () => {
    it("closes the dialog after a successful submit", async () => {
      vi.mocked(onboardingActions.addNewCompanies).mockResolvedValue({
        success: true,
      });
      const user = userEvent.setup();
      render(<AddMoreCompaniesDialog />);

      await openDialog(user);
      await addOneCompany(user);
      await clickAddButton(user);

      await waitFor(() => {
        expect(screen.queryByText("Add Target Companies")).not.toBeInTheDocument();
      });
    });

    it("resets selected companies list after successful submit (re-open shows empty list)", async () => {
      vi.mocked(onboardingActions.addNewCompanies).mockResolvedValue({
        success: true,
      });
      const user = userEvent.setup();
      render(<AddMoreCompaniesDialog />);

      // Open, add a company, submit
      await openDialog(user);
      await addOneCompany(user);
      await clickAddButton(user);

      // Wait for dialog to close
      await waitFor(() => {
        expect(screen.queryByText("Add Target Companies")).not.toBeInTheDocument();
      });

      // Re-open the dialog
      await openDialog(user);

      // The selected companies list should be reset
      expect(screen.getByText(/no companies selected yet/i)).toBeInTheDocument();
    });
  });

  describe("clicking outside the dialog closes it without saving", () => {
    it("closes the dialog when Escape is pressed", async () => {
      const user = userEvent.setup();
      render(<AddMoreCompaniesDialog />);

      await openDialog(user);
      expect(screen.getByText("Add Target Companies")).toBeInTheDocument();

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByText("Add Target Companies")).not.toBeInTheDocument();
      });
    });

    it("does not call addNewCompanies when the dialog is closed via Escape", async () => {
      const user = userEvent.setup();
      render(<AddMoreCompaniesDialog />);

      await openDialog(user);
      await addOneCompany(user);

      // Close without submitting
      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByText("Add Target Companies")).not.toBeInTheDocument();
      });
      expect(onboardingActions.addNewCompanies).not.toHaveBeenCalled();
    });
  });
});
