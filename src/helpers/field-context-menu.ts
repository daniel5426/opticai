import { BrowserWindow, clipboard, Menu, type MenuItemConstructorOptions } from "electron";

const LABELS = {
  he: { copy: "העתק", cut: "גזור", paste: "הדבק", selectAll: "בחר הכל" },
  en: { copy: "Copy", cut: "Cut", paste: "Paste", selectAll: "Select all" },
  fr: { copy: "Copier", cut: "Couper", paste: "Coller", selectAll: "Tout sélectionner" },
};

// Runs in the page, as text so bundling cannot change it: the value of the field under the pointer
// (a locked field cannot be selected) and the page's language.
export const READ_FIELD_SCRIPT = `(x, y) => {
  const field = document.elementFromPoint(x, y)?.closest("input, textarea, select, [role=combobox], button");
  let value = "";
  if (field instanceof HTMLInputElement) value = field.type === "password" ? "" : field.value;
  else if (field instanceof HTMLTextAreaElement) value = field.value;
  else if (field instanceof HTMLSelectElement) value = field.selectedOptions[0]?.text || "";
  else if (field instanceof HTMLElement) value = field.innerText ?? field.textContent ?? "";
  return { value: value.trim(), lang: document.documentElement.lang };
}`;

/** Electron has no right-click menu; give fields and selected text Copy (and Cut/Paste/Select all while editing). */
export function installFieldContextMenu(window: BrowserWindow) {
  window.webContents.on("context-menu", async (_event, params) => {
    let field = { value: "", lang: "" };
    try {
      field = await window.webContents.executeJavaScript(`(${READ_FIELD_SCRIPT})(${params.x}, ${params.y})`);
    } catch {
      // The page may be navigating; selected text can still be copied.
    }
    const labels = LABELS[field.lang as keyof typeof LABELS] || LABELS.he;
    const copyText = params.selectionText || field.value;
    if (!copyText && !params.isEditable) return;
    const items: MenuItemConstructorOptions[] = [
      {
        label: labels.copy,
        enabled: Boolean(copyText),
        click: () => (params.selectionText ? window.webContents.copy() : clipboard.writeText(field.value)),
      },
    ];
    if (params.isEditable) {
      items.unshift({ label: labels.cut, role: "cut", enabled: params.editFlags.canCut });
      items.push(
        { label: labels.paste, role: "paste", enabled: params.editFlags.canPaste },
        { type: "separator" },
        { label: labels.selectAll, role: "selectAll" },
      );
    }
    Menu.buildFromTemplate(items).popup({ window });
  });
}
