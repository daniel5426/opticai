import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SubjectiveTab } from "@/components/exam/SubjectiveTab";
import type { SubjectiveExam } from "@/lib/db/schema-interface";

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
afterEach(cleanup);

// The SoftOptic sample exam's subjective, as imported.
const data = { layout_instance_id: 1, r_va: "6/45", r_j: "J4", l_j: "J5", r_ph: "99", l_ph: "99" } as unknown as SubjectiveExam;

const renderTab = (softopticColumns?: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SubjectiveTab subjectiveData={data} onSubjectiveChange={vi.fn()} isEditing={false} onMultifocalClick={vi.fn()} softopticColumns={softopticColumns} />
    </QueryClientProvider>,
  );

describe("Subjective card columns", () => {
  test("system exams keep the card as it was, without J or P.H", () => {
    renderTab();
    expect(screen.queryByText("J")).toBeNull();
    expect(screen.queryByText("P.H")).toBeNull();
  });

  test("SoftOptic imports add OpticSoft's J and P.H columns", () => {
    renderTab(true);
    expect(screen.getByText("J")).toBeTruthy();
    expect(screen.getByText("P.H")).toBeTruthy();
  });
});
