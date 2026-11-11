import { afterEach, expect, test, vi } from "vitest";

vi.mock("electron", () => ({ clipboard: {}, Menu: {} }));
import { READ_FIELD_SCRIPT } from "@/helpers/field-context-menu";

afterEach(() => { document.body.innerHTML = ""; });

const readAt = (element: Element) => {
  document.elementFromPoint = () => element;
  return new Function(`return (${READ_FIELD_SCRIPT})(1, 1)`)();
};

test("reads the value of a locked field under the pointer", () => {
  document.documentElement.lang = "he";
  document.body.innerHTML = `<input disabled value=" -8.00 "><button role="combobox"><span>עין ימין</span></button><input type="password" value="secret">`;
  const [field, password] = document.querySelectorAll("input");
  expect(readAt(field)).toEqual({ value: "-8.00", lang: "he" });
  expect(readAt(document.querySelector("span")!).value).toBe("עין ימין");
  expect(readAt(password).value).toBe("");
});
