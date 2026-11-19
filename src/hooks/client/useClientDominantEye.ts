import { useQuery } from "@tanstack/react-query";
import { getExamsByClientId } from "@/lib/db/exams-db";

export type DominantEye = "R" | "L";

/** Exams and imports store the dominant eye as R/L, right/left or ימין/שמאל. */
export function normalizeDominantEye(value?: string | null): DominantEye | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (["r", "right", "ימין", "od"].includes(text)) return "R";
  if (["l", "left", "שמאל", "os"].includes(text)) return "L";
  return null;
}

/**
 * The dominant eye from the client's most recent exam that records one.
 * The key sits under the client's "exams" section, so saving an exam refreshes it.
 */
export function useClientDominantEye(clientId?: number | null) {
  const id = Number(clientId) || 0;
  return useQuery({
    queryKey: ["client", id, "exams", "dominant-eye"],
    queryFn: () => getExamsByClientId(id),
    enabled: id > 0,
    select: (exams) => {
      for (const exam of exams) {
        const eye = normalizeDominantEye(exam.dominant_eye);
        if (eye) return eye;
      }
      return null;
    },
  });
}
