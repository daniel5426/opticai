import { describe, expect, test } from "vitest";
import { resolveDocxTemplateUrl } from "@/lib/docx-generator";

describe("resolveDocxTemplateUrl", () => {
  test("keeps public template paths absolute on web origins", () => {
    expect(
      resolveDocxTemplateUrl("/templates/regular-order.docx", {
        locationProtocol: "https:",
        moduleUrl: "https://prysm-web-production.up.railway.app/assets/index.js",
      }),
    ).toBe("/templates/regular-order.docx");
  });

  test("resolves public template paths beside packaged assets on file origins", () => {
    expect(
      resolveDocxTemplateUrl("/templates/regular-order.docx", {
        locationProtocol: "file:",
        moduleUrl: "file:///C:/Program%20Files/Prysm/resources/app.asar/dist/assets/index.js",
      }),
    ).toBe(
      "file:///C:/Program%20Files/Prysm/resources/app.asar/dist/templates/regular-order.docx",
    );
  });

  test("does not rewrite explicit urls", () => {
    expect(
      resolveDocxTemplateUrl("https://example.com/templates/regular-order.docx", {
        locationProtocol: "file:",
        moduleUrl: "file:///C:/Program%20Files/Prysm/resources/app.asar/dist/assets/index.js",
      }),
    ).toBe("https://example.com/templates/regular-order.docx");
  });
});
