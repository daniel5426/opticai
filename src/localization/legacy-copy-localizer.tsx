import { useEffect, useRef } from "react";
import { legacyStaticCopy } from "./legacy-static-copy";
import { useAppLocale } from "./use-app-locale";

const translatedAttributes = ["aria-label", "placeholder", "title", "alt"];
const noLocalizeSelector = "[data-no-localize]";
const sourceCopy = legacyStaticCopy as Record<
  string,
  { en: string; fr: string }
>;

function translate(value: string, locale: "en" | "fr") {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const translated = sourceCopy[value.trim()]?.[locale];
  return translated ? `${leading}${translated}${trailing}` : value;
}

function isLocalizationDisabled(node: Node) {
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;

  return Boolean(element?.closest(noLocalizeSelector));
}

/**
 * Compatibility bridge for the legacy Hebrew-first renderer. It localizes
 * static copy that has not yet been converted to a direct `t()` call while
 * leaving user-entered values and clinical LTR fields untouched.
 */
export function LegacyCopyLocalizer() {
  const { locale } = useAppLocale();
  const originalText = useRef(new WeakMap<Text, string>());
  const originalAttributes = useRef(
    new WeakMap<Element, Map<string, string>>(),
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const targetLocale = locale === "he" ? null : locale;

    const localizeText = (node: Text) => {
      if (isLocalizationDisabled(node)) return;
      const current = node.nodeValue ?? "";
      if (!current.trim()) return;
      if (targetLocale && sourceCopy[current.trim()]) {
        originalText.current.set(node, current);
        node.nodeValue = translate(current, targetLocale);
      }
    };

    const localizeElement = (element: Element) => {
      if (isLocalizationDisabled(element)) return;
      for (const attribute of translatedAttributes) {
        const current = element.getAttribute(attribute);
        if (!current || !sourceCopy[current.trim()] || !targetLocale) continue;
        const attributes = originalAttributes.current.get(element) ?? new Map();
        attributes.set(attribute, current);
        originalAttributes.current.set(element, attributes);
        element.setAttribute(attribute, translate(current, targetLocale));
      }
    };

    const restore = () => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );
      let node = walker.nextNode();
      while (node) {
        const original = originalText.current.get(node as Text);
        if (original !== undefined) (node as Text).nodeValue = original;
        node = walker.nextNode();
      }
      document.querySelectorAll("*").forEach((element) => {
        const attributes = originalAttributes.current.get(element);
        attributes?.forEach((value, name) => element.setAttribute(name, value));
      });
    };

    restore();
    if (!targetLocale) return;

    const localizeTree = (root: Node) => {
      if (isLocalizationDisabled(root)) return;
      if (root.nodeType === Node.TEXT_NODE) localizeText(root as Text);
      if (root.nodeType === Node.ELEMENT_NODE) localizeElement(root as Element);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        localizeText(node as Text);
        node = walker.nextNode();
      }
      if (root.nodeType === Node.ELEMENT_NODE) {
        (root as Element).querySelectorAll("*").forEach(localizeElement);
      }
    };

    localizeTree(document.body);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData")
          localizeText(record.target as Text);
        if (record.type === "attributes")
          localizeElement(record.target as Element);
        record.addedNodes.forEach(localizeTree);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: translatedAttributes,
    });
    return () => observer.disconnect();
  }, [locale]);

  return null;
}
