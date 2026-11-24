import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import ExamDetailPage from "@/pages/ExamDetailPage";

const fixture = vi.hoisted(() => ({
  user: { id: 2 },
  clinic: { id: 1 },
  client: { id: 7, first_name: "Review client" },
  setActiveTab: vi.fn(),
  registerGuard: vi.fn(),
  navigate: vi.fn(),
  pageData: vi.fn(),
  contactOrder: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (original) => ({
  ...await original<object>(),
  useNavigate: () => fixture.navigate,
  useParams: () => ({}),
  useSearch: () => ({}),
  useBlocker: () => ({ status: "idle" }),
}));
vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({ currentUser: fixture.user, currentClinic: fixture.clinic }),
}));
vi.mock("@/contexts/ClientSidebarContext", () => ({
  useClientSidebar: () => ({ currentClient: fixture.client, setActiveTab: fixture.setActiveTab }),
}));
vi.mock("@/contexts/NavigationGuardContext", () => ({
  useNavigationGuard: () => ({ registerGuard: fixture.registerGuard }),
}));
vi.mock("@/components/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/layouts/ClientSpaceLayout", () => ({ ClientSpaceLayout: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/migration/ImportedSourceDataDialog", () => ({ ImportedSourceDataDialog: () => null }));
vi.mock("@/lib/db/exams-db", async (original) => ({
  ...await original<object>(),
  getExamPageData: fixture.pageData,
}));
vi.mock("@/lib/api-client", () => ({
  apiClient: { getContactLensOrder: fixture.contactOrder, getLookupTable: vi.fn(async () => ({ data: [] })) },
}));
vi.mock("@/components/exam/ExamLayoutRenderer", () => ({
  ExamLayoutRenderer: ({ gridItems, examFormData, detailProps }: {
    gridItems: { id: string; type: string }[];
    examFormData: Record<string, { r_sph?: number }>;
    detailProps: { fieldHandlers: Record<string, (field: string, value: string) => void> };
  }) => gridItems.map(({ id, type }) => {
    const key = `${type}-${id}`;
    return <input key={key} aria-label={id} value={examFormData[key]?.r_sph ?? ""}
      onChange={event => detailProps.fieldHandlers[key]("r_sph", event.target.value)} />;
  }),
}));

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
    unobserve() {}
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const template = {
  id: 31,
  name: "Standard layout",
  layout_data: JSON.stringify({ version: 2, items: [{ id: "template-objective", type: "objective", x: 0, y: 0, w: 6 }] }),
};

const importedInstance = {
  instance: { id: 10, layout_id: null },
  exam_data: {
    objective: { card_instance_id: "source-objective", r_sph: -2.25 },
    "objective-source-objective": { card_instance_id: "source-objective", r_sph: -2.25 },
  },
};

function renderExam(withSavedLayout: boolean) {
  const regular = {
    instance: { id: 11, layout_id: template.id },
    layout: template,
    exam_data: { "objective-template-objective": { card_instance_id: "template-objective", r_sph: -3 } },
  };
  fixture.pageData.mockResolvedValue({
    exam: { id: 42, client_id: 7, clinic_id: 1, type: "exam", exam_date: "2020-01-01" },
    instances: withSavedLayout ? [importedInstance, regular] : [importedInstance],
    chosen_active_instance_id: withSavedLayout ? 11 : 10,
    available_layouts: [template],
  });
  render(<QueryClientProvider client={new QueryClient()}>
    <ExamDetailPage examId="42" clientId="7" />
  </QueryClientProvider>);
}

test("adding a regular layout keeps the imported tabs available and seeds matching fields", async () => {
  const user = userEvent.setup();
  renderExam(false);
  const sourceField = await screen.findByLabelText("source-objective");
  expect(sourceField).toHaveValue("-2.25");
  await user.click(screen.getByRole("button", { name: "עריכת בדיקה" }));
  fireEvent.change(sourceField, { target: { value: "-2.5" } });
  await user.click(screen.getByRole("button", { name: "הוספת פריסה" }));
  await user.click(await screen.findByRole("menuitem", { name: "Standard layout" }));
  const layoutField = await screen.findByLabelText("template-objective");
  expect(layoutField).toHaveValue("-2.5");
  fireEvent.change(layoutField, { target: { value: "-3" } });

  await user.click(screen.getByRole("tab", { name: "Objective" }));
  expect(await screen.findByLabelText("source-objective")).toHaveValue("-2.5");
  expect(screen.getByText("Standard layout")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "הצגת מקטעים ריקים מהייבוא" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "הוספת פריסה" }));
  expect(await screen.findByRole("menuitemcheckbox", { name: "הצגת מקטעים ריקים מהייבוא" })).toBeInTheDocument();
  await user.keyboard("{Escape}");
  await user.click(screen.getByText("Standard layout"));
  expect(await screen.findByLabelText("template-objective")).toHaveValue("-3");
});

test("reopening an exam with a saved layout still exposes its original imported fields", async () => {
  renderExam(true);
  expect(await screen.findByLabelText("template-objective")).toHaveValue("-3");
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Objective" }), { button: 0 });
  expect(await screen.findByLabelText("source-objective")).toHaveValue("-2.25");
});

test("a contact-lens order exam has a named tab and shows readings without repeating the title type", async () => {
  fixture.pageData.mockResolvedValue({
    exam: {
      id: 42, client_id: 7, clinic_id: 1, type: "softoptic_contact_order", exam_date: "2020-01-01",
      test_name: "עדשות מגע · התאמה חוזרת",
    },
    instances: [],
    available_layouts: [],
    softoptic_contact_entry: { order_id: 71, checks: [] },
  });
  fixture.contactOrder.mockResolvedValue({
    data: {
      id: 71, client_id: 7, clinic_id: 1, type: "התאמה חוזרת", notes: "Order note",
      order_data: { "keratometer-contact-lens": { r_rh: 7.51 } },
    },
  });
  render(<QueryClientProvider client={new QueryClient()}>
    <ExamDetailPage examId="42" clientId="7" />
  </QueryClientProvider>);

  const tab = await screen.findByRole("tab", { name: "עדשות מגע", selected: true });
  const panel = screen.getByRole("tabpanel", { name: "עדשות מגע" });
  expect(tab).toHaveAttribute("aria-controls", panel.id);
  expect(await screen.findByText("Keratometer Contact Lens")).toBeInTheDocument();
  expect(screen.getByText("Order note")).toBeInTheDocument();
  expect(panel).not.toHaveTextContent("התאמה חוזרת");
});
