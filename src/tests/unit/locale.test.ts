import { afterEach, describe, expect, it } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { createElement, Fragment } from "react";
import {
  getActiveLocale,
  getDirection,
  normalizeLocale,
  supportedLocales,
} from "@/localization/locale";
import { legacyStaticCopy } from "@/localization/legacy-static-copy";
import i18n from "@/localization/i18n";
import { LegacyCopyLocalizer } from "@/localization/legacy-copy-localizer";

describe("Electron locales", () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage("he");
    });
    localStorage.clear();
    delete (window as Window & { electronAPI?: unknown }).electronAPI;
  });

  it("supports Hebrew, English, and French", () => {
    expect(supportedLocales).toEqual(["he", "en", "fr"]);
    expect(normalizeLocale("fr-FR")).toBe("fr");
    expect(normalizeLocale("en-GB")).toBe("en");
    expect(getDirection("he")).toBe("rtl");
    expect(getDirection("en")).toBe("ltr");
    expect(getDirection("fr")).toBe("ltr");
  });

  it("restores the saved Electron locale without changing the browser companion default", () => {
    (window as Window & { electronAPI?: unknown }).electronAPI = {};
    localStorage.setItem("lang", "fr");

    expect(getActiveLocale()).toBe("fr");

    delete (window as Window & { electronAPI?: unknown }).electronAPI;
    expect(getActiveLocale()).toBe("he");
  });

  it("ships the legacy static-copy catalog for English and French", () => {
    expect(Object.keys(legacyStaticCopy).length).toBeGreaterThan(1_500);
    expect(legacyStaticCopy["אובייקטיבי"]).toEqual({
      en: "objective",
      fr: "objectif",
    });
  });

  it("localizes legacy renderer text and accessible labels at runtime", async () => {
    const { getByTestId, unmount } = render(
      createElement(
        Fragment,
        null,
        createElement(LegacyCopyLocalizer),
        createElement(
          "button",
          { "data-testid": "legacy-copy", "aria-label": "אובייקטיבי" },
          "אובייקטיבי",
        ),
      ),
    );

    const button = getByTestId("legacy-copy");
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    await waitFor(() => {
      expect(button.textContent).toBe("objective");
      expect(button.getAttribute("aria-label")).toBe("objective");
    });

    await act(async () => {
      await i18n.changeLanguage("fr");
    });
    await waitFor(() => {
      expect(button.textContent).toBe("objectif");
      expect(button.getAttribute("aria-label")).toBe("objectif");
    });

    await act(async () => {
      await i18n.changeLanguage("he");
    });
    await waitFor(() => {
      expect(button.textContent).toBe("אובייקטיבי");
      expect(button.getAttribute("aria-label")).toBe("אובייקטיבי");
    });
    unmount();
  });
});
