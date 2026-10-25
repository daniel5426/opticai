import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import i18n from "@/localization/i18n";
import { GlobalSearch } from "@/components/GlobalSearch";

const { search, recent, navigate } = vi.hoisted(() => ({
  search: vi.fn(), recent: vi.fn(), navigate: vi.fn(),
}));
vi.mock("@/lib/api-client", () => ({ apiClient: { unifiedSearch: search, getRecentClients: recent } }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@/components/exam/shared/OptimizedInputs", () => ({ FastInput: () => null }));

const details = {
  national_id: "001234567", phone_mobile: "050-123-4567",
  phone_home: "02-123-4567", phone_work: "03-123-4567",
  additional_phone: "054-123-4567", email: "dana@example.com",
  date_of_birth: "1990-04-23", health_fund: "מכבי",
  address_street: "Herzl", address_number: "12", address_city: "Haifa", postal_code: "0123456",
};
const hit = { type: "client", id: 7, title: "Dana Cohen", subtitle: "001234567", description: "Haifa Herzl", client_details: details };

beforeEach(() => {
  vi.clearAllMocks();
  search.mockResolvedValue({ data: { items: [hit], total: 1 } });
});
afterEach(cleanup);

async function searchClients() {
  const onClose = vi.fn();
  const view = render(<GlobalSearch inModal onClose={onClose} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Dana" } });
  const result = await screen.findByRole("button", { name: /Dana Cohen/ });
  return { ...view, result, onClose };
}

describe("client previews in general search", () => {
  test.each([
    ["he", "rtl", "תאריך לידה", "כתובת"],
    ["en", "ltr", "Date of birth", "Address"],
    ["fr", "ltr", "Date de naissance", "Adresse"],
  ])("shows contact and identity details in %s", async (locale, direction, birthLabel, addressLabel) => {
    await i18n.changeLanguage(locale);
    const { container, result, onClose } = await searchClients();
    expect(container.firstElementChild).toHaveAttribute("dir", direction);
    expect(within(result).getByText(`${birthLabel}:`)).toBeVisible();
    expect(within(result).getByText(`${addressLabel}:`)).toBeVisible();
    for (const value of [details.national_id, details.phone_mobile, details.phone_home, details.phone_work, details.additional_phone, details.email, "23/04/1990"]) {
      expect(within(result).getByText(value)).toHaveAttribute("dir", "ltr");
    }
    expect(within(result).getByText("Herzl 12, Haifa, 0123456")).toBeVisible();
    expect(within(result).getByText("מכבי")).toBeVisible();
    expect(search).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(result);
    expect(navigate).toHaveBeenCalledWith({ to: "/clients/$clientId", params: { clientId: "7" }, search: { tab: "details" } });
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("handles missing details and responses from older backends", async () => {
    await i18n.changeLanguage("en");
    search.mockResolvedValue({ data: { items: [
      { ...hit, client_details: { phone_mobile: details.phone_mobile } },
      { type: "client", id: 8, title: "Legacy Client", subtitle: "000123456", description: "Tel Aviv" },
    ], total: 2 } });
    const { result } = await searchClients();
    expect(within(result).getByText(details.phone_mobile)).toBeVisible();
    expect(within(result).queryByText("Email:")).not.toBeInTheDocument();
    expect(within(result).queryByText("Date of birth:")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Legacy Client.*000123456.*Tel Aviv/ })).toBeVisible();
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ params: { clientId: "8" } }));
  });

  test("shows the same preview for recently viewed clients", async () => {
    await i18n.changeLanguage("en");
    recent.mockResolvedValue({ data: [{ id: 1, client_id: 7, client: { first_name: "Dana", last_name: "Cohen", ...details } }] });
    render(<GlobalSearch inModal />);
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Recently viewed clients" }));
    const result = await screen.findByRole("button", { name: /Dana Cohen/ });
    expect(within(result).getByText(details.email)).toBeVisible();
    expect(search).not.toHaveBeenCalled();
  });

  test("does not let an older search overwrite the latest client's preview", async () => {
    await i18n.changeLanguage("en");
    let resolveFirst: (value: unknown) => void;
    search.mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }));
    search.mockResolvedValue({ data: { items: [{ ...hit, id: 8, title: "David Levy" }], total: 1 } });
    render(<GlobalSearch inModal />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Dana" } });
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "David" } });
    await screen.findByRole("button", { name: /David Levy/ });
    resolveFirst!({ data: { items: [hit], total: 1 } });
    await waitFor(() => expect(screen.queryByRole("button", { name: /Dana Cohen/ })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: /David Levy/ })).toBeVisible();
  });
});
