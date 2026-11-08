import { beforeEach, describe, expect, test, vi } from "vitest";

const createAppointmentApi = vi.fn();
vi.mock("@/lib/api-client", () => ({
  apiClient: { createAppointment: (...args: unknown[]) => createAppointmentApi(...args) },
}));

import i18n from "@/localization/i18n";
import { appointmentSaveErrorMessage, createAppointment } from "@/lib/db/appointments-db";

const book = () => createAppointment({ client_id: 1, date: "2026-11-09", time: "09:45" });

describe("appointment overlap message", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("he");
  });

  test("names the appointment already booked there", async () => {
    createAppointmentApi.mockResolvedValue({
      error: "agent.slotUnavailable",
      status: 409,
      errorDetail: {
        code: "agent.slotUnavailable",
        conflict: { time: "09:30", end_time: "10:15", client_name: "נועה לוי", user_name: "ישראל ישראלי" },
      },
    });
    expect(await book()).toBeNull();
    expect(appointmentSaveErrorMessage("שגיאה ביצירת התור")).toBe(
      "לא ניתן לקבוע את התור: כבר קיים תור של ישראל ישראלי בשעות 09:30–10:15 עם נועה לוי. בחרו שעה אחרת או בודק אחר.",
    );
  });

  test("keeps the caller's message for other failures", async () => {
    createAppointmentApi.mockResolvedValue({ error: "HTTP 500", status: 500 });
    await book();
    expect(appointmentSaveErrorMessage("שגיאה ביצירת התור")).toBe("שגיאה ביצירת התור");
  });
});
