import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { NavMain } from "@/components/nav-main";
import { NavDocuments } from "@/components/nav-documents";

const route = vi.hoisted(() => ({ pathname: "/orders", state: { __TSR_key: "" } }));
vi.mock("@tanstack/react-router", () => ({ useLocation: () => route }));
vi.mock("@/components/GuardedRouterLink", () => ({ GuardedRouterLink: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a> }));
vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
afterEach(cleanup);

const items = [{ title: "Clients", url: "/clients" }];
const documents = [{ name: "Orders", url: "/orders", icon: () => null }];
const active = () => screen.getAllByRole("link").filter((link) => link.closest("[data-active=true]")).map((link) => link.textContent);
const show = (pathname: string, key = "") => {
  route.pathname = pathname;
  route.state.__TSR_key = key;
  cleanup();
  render(<SidebarProvider><NavMain items={items} showAddClientButton={false} /><NavDocuments items={documents as any} /></SidebarProvider>);
};

test("an order opened from the orders list keeps Orders active", () => {
  show("/orders");
  expect(active()).toEqual(["Orders"]);
  show("/clients/7/orders/group-3");
  expect(active()).toEqual(["Orders"]);
});

test("a client opened from the clients list keeps Clients active", () => {
  show("/clients");
  show("/clients/7/orders/group-3");
  expect(active()).toEqual(["Clients"]);
});

test("back and forward restore the source section for each history entry", () => {
  const order = "/clients/7/orders/group-3";
  show("/orders", "orders");
  show(order, "from-orders");
  show("/clients", "clients");
  show(order, "from-clients");
  expect(active()).toEqual(["Clients"]);
  show(order, "from-orders");
  expect(active()).toEqual(["Orders"]);
  show(order, "from-clients");
  expect(active()).toEqual(["Clients"]);
});
