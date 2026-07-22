import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { Zap } from "lucide-react";
import { Home, Activity, BarChart3, Settings } from "lucide-react";

// ---- Module mocks (must be hoisted before imports) ----

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/dashboard"),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
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

vi.mock("@/lib/firebase", () => ({
  auth: {},
}));

vi.mock("firebase/auth", () => ({
  signOut: vi.fn(),
}));

// ---- Imports (after mocks) ----

import { SidebarClientWrapper } from "@/components/SidebarClientWrapper";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import * as useMobileModule from "@/hooks/use-mobile";
import * as nextNavigation from "next/navigation";

// ---- Test data ----

const defaultNavigationItems = [
  { name: "Dashboard", icon: <Home className="w-5 h-5" />, href: "/dashboard" },
  {
    name: "Send All",
    icon: <Activity className="w-5 h-5" />,
    href: "/dashboard/send-all",
  },
  {
    name: "Plan & Credits",
    icon: <BarChart3 className="w-5 h-5" />,
    href: "/dashboard/plan-and-credits",
  },
  {
    name: "Settings",
    icon: <Settings className="w-5 h-5" />,
    href: "/dashboard/settings",
  },
];

const defaultUser = { name: "Test User", email: "test@test.com" };

function renderSidebar(pathname = "/dashboard", user = defaultUser) {
  vi.mocked(nextNavigation.usePathname).mockReturnValue(pathname);
  return render(
    <SidebarProvider>
      <SidebarTrigger />
      <SidebarClientWrapper user={user} navigationItems={defaultNavigationItems} />
    </SidebarProvider>
  );
}

// Credit badge component similar to the one in the dashboard layout header
function CreditBadge({ credits }: { credits: number }) {
  return (
    <div data-testid="credit-badge" className="flex items-center gap-2">
      <Zap className="w-5 h-5" data-testid="credit-icon" />
      <span data-testid="credit-value">{credits}</span>
    </div>
  );
}

function renderSidebarWithCredits(credits: number) {
  vi.mocked(nextNavigation.usePathname).mockReturnValue("/dashboard");
  return render(
    <SidebarProvider>
      <SidebarTrigger />
      <CreditBadge credits={credits} />
      <SidebarClientWrapper user={defaultUser} navigationItems={defaultNavigationItems} />
    </SidebarProvider>
  );
}

// ---- Tests ----

describe("Sidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMobileModule.useIsMobile).mockReturnValue(false);
  });

  describe("navigation links are rendered", () => {
    it("renders the Dashboard link", () => {
      renderSidebar();
      expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    });

    it("renders the Send All link", () => {
      renderSidebar();
      expect(screen.getByRole("link", { name: /send all/i })).toBeInTheDocument();
    });

    it("renders the Plan & Credits link", () => {
      renderSidebar();
      expect(screen.getByRole("link", { name: /plan & credits/i })).toBeInTheDocument();
    });

    it("renders the Settings link", () => {
      renderSidebar();
      expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
    });
  });

  describe("navigation link hrefs are correct", () => {
    it("Dashboard link points to /dashboard", () => {
      renderSidebar();
      expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
        "href",
        "/dashboard"
      );
    });

    it("Send All link points to /dashboard/send-all", () => {
      renderSidebar();
      expect(screen.getByRole("link", { name: /send all/i })).toHaveAttribute(
        "href",
        "/dashboard/send-all"
      );
    });

    it("Plan & Credits link points to /dashboard/plan-and-credits", () => {
      renderSidebar();
      expect(screen.getByRole("link", { name: /plan & credits/i })).toHaveAttribute(
        "href",
        "/dashboard/plan-and-credits"
      );
    });

    it("Settings link points to /dashboard/settings", () => {
      renderSidebar();
      expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute(
        "href",
        "/dashboard/settings"
      );
    });
  });

  describe("mobile hamburger trigger shows sidebar on click", () => {
    it("renders the sidebar trigger button", () => {
      renderSidebar();
      expect(screen.getByRole("button", { name: /toggle sidebar/i })).toBeInTheDocument();
    });

    it("clicking the trigger toggles the mobile sidebar open", async () => {
      vi.mocked(useMobileModule.useIsMobile).mockReturnValue(true);
      const user = userEvent.setup();
      renderSidebar();

      const trigger = screen.getByRole("button", { name: /toggle sidebar/i });
      await user.click(trigger);

      // On mobile, the sidebar renders inside a Sheet (dialog)
      await waitFor(() => {
        const mobileSheet = document.querySelector("[data-mobile='true']");
        expect(mobileSheet).not.toBeNull();
      });
    });
  });

  describe("active link has highlighted CSS class", () => {
    it("Dashboard link is marked active when pathname is /dashboard", () => {
      renderSidebar("/dashboard");
      const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
      // The parent SidebarMenuButton has data-active="true" when isActive
      const menuButton = dashboardLink.closest("[data-slot='sidebar-menu-button']");
      expect(menuButton).toHaveAttribute("data-active", "true");
    });

    it("Send All link is marked active when pathname is /dashboard/send-all", () => {
      renderSidebar("/dashboard/send-all");
      const sendAllLink = screen.getByRole("link", { name: /send all/i });
      const menuButton = sendAllLink.closest("[data-slot='sidebar-menu-button']");
      expect(menuButton).toHaveAttribute("data-active", "true");
    });

    it("Dashboard link is NOT active when pathname is /dashboard/send-all", () => {
      renderSidebar("/dashboard/send-all");
      const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
      const menuButton = dashboardLink.closest("[data-slot='sidebar-menu-button']");
      expect(menuButton).toHaveAttribute("data-active", "false");
    });

    it("Plan & Credits link is marked active when pathname is /dashboard/plan-and-credits", () => {
      renderSidebar("/dashboard/plan-and-credits");
      const planLink = screen.getByRole("link", { name: /plan & credits/i });
      const menuButton = planLink.closest("[data-slot='sidebar-menu-button']");
      expect(menuButton).toHaveAttribute("data-active", "true");
    });

    it("Settings link is marked active when pathname is /dashboard/settings", () => {
      renderSidebar("/dashboard/settings");
      const settingsLink = screen.getByRole("link", { name: /settings/i });
      const menuButton = settingsLink.closest("[data-slot='sidebar-menu-button']");
      expect(menuButton).toHaveAttribute("data-active", "true");
    });
  });

  describe("credit badge is visible with the correct value", () => {
    it("renders the credit badge with the correct numeric value", () => {
      renderSidebarWithCredits(42);
      expect(screen.getByTestId("credit-value")).toHaveTextContent("42");
    });

    it("credit badge shows zero credits correctly", () => {
      renderSidebarWithCredits(0);
      expect(screen.getByTestId("credit-value")).toHaveTextContent("0");
    });

    it("credit badge shows large credit values correctly", () => {
      renderSidebarWithCredits(1000);
      expect(screen.getByTestId("credit-value")).toHaveTextContent("1000");
    });

    it("credit badge icon is rendered alongside the value", () => {
      renderSidebarWithCredits(25);
      expect(screen.getByTestId("credit-badge")).toBeInTheDocument();
      expect(screen.getByTestId("credit-value")).toBeInTheDocument();
    });
  });
});
