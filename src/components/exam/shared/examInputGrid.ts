/** Keep headers and eye rows aligned while reserving room for numeric suffixes. */
export function getExamInputGridTemplate(
  columns: readonly { key: string; suffix?: string }[],
  hideEyeLabels: boolean,
): string {
  const tracks = columns.map(({ key, suffix }) => {
    if (key === "reflex") return "2fr";
    return suffix ? "minmax(4rem, 1.2fr)" : "1fr";
  });
  return [...(hideEyeLabels ? [] : ["20px"]), ...tracks].join(" ");
}
