import { inputSyncManager } from "./OptimizedInputs"

export function copyEyeRowFields<T extends Record<string, any>>(
  data: T,
  onChange: (field: keyof T, value: string) => void,
  fromEye: "R" | "L",
) {
  inputSyncManager.flush()

  const sourcePrefix = fromEye === "R" ? "r_" : "l_"
  const targetPrefix = fromEye === "R" ? "l_" : "r_"

  Object.keys(data).forEach((field) => {
    if (!field.startsWith(sourcePrefix)) return

    const targetField = `${targetPrefix}${field.slice(2)}` as keyof T
    const value = data[field]
    if (value !== undefined) {
      onChange(targetField, String(value ?? ""))
    }
  })
}
