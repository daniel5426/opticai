import React from "react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimeInput } from "@/components/ui/time";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconLayoutGrid } from "@tabler/icons-react";
import { Settings } from "@/lib/db/schema-interface";

interface PreferencesTabProps {
  localSettings: Settings;
  onInputChange: (
    field: keyof Settings,
    value: string | number | boolean,
  ) => void;
}

export function PreferencesTab({
  localSettings,
  onInputChange,
}: PreferencesTabProps) {
  return (
    <div className="space-y-6">
      <Card className="">
        <CardContent>
          <div className="flex items-center justify-between">
            <Link to="/exam-layouts">
              <Button variant="outline" className="flex items-center gap-2">
                <IconLayoutGrid className="h-4 w-4" />
                נהל פריסות בדיקה
              </Button>
            </Link>
            <div className="text-right">
              <h3 className="font-medium">פריסות בדיקה</h3>
              <p className="text-muted-foreground text-sm">
                יצירה ועריכה של פריסות בדיקה מותאמות אישית
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle className="text-right">שעות עבודה</CardTitle>
          <p className="text-muted-foreground text-right text-sm">
            הגדר שעות פעילות והפסקות
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="work_start_time" className="block text-right">
                התחלה
              </Label>
              <TimeInput
                id="work_start_time"
                value={localSettings.work_start_time || "08:00"}
                onChange={(e) =>
                  onInputChange("work_start_time", e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="work_end_time" className="block text-right">
                סיום
              </Label>
              <TimeInput
                id="work_end_time"
                value={localSettings.work_end_time || "18:00"}
                onChange={(e) => onInputChange("work_end_time", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="break_start_time" className="block text-right">
                הפסקה מ
              </Label>
              <TimeInput
                id="break_start_time"
                value={localSettings.break_start_time || ""}
                onChange={(e) =>
                  onInputChange("break_start_time", e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="break_end_time" className="block text-right">
                הפסקה עד
              </Label>
              <TimeInput
                id="break_end_time"
                value={localSettings.break_end_time || ""}
                onChange={(e) =>
                  onInputChange("break_end_time", e.target.value)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle className="text-right">בדיקות אופטומטריה</CardTitle>
          <p className="text-muted-foreground text-right text-sm">
            הגדרות ברירת מחדל לשדות בדיקה
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex w-full flex-col items-start gap-2 text-right" dir="rtl">
            <Label htmlFor="va_test_distance" className="block text-right">
              מרחק בדיקת VA
            </Label>
            <Select
              dir="rtl"
              value={String(localSettings.va_test_distance || 6)}
              onValueChange={(value) =>
                onInputChange("va_test_distance", Number(value))
              }
            >
              <SelectTrigger
                id="va_test_distance"
                className="w-[200px] justify-end text-right [&>span]:w-full [&>span]:text-right"
                dir="rtl"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="2">2 מטר</SelectItem>
                <SelectItem value="3">3 מטר</SelectItem>
                <SelectItem value="4">4 מטר</SelectItem>
                <SelectItem value="5">5 מטר</SelectItem>
                <SelectItem value="6">6 מטר</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle className="text-right">תורים</CardTitle>
          <p className="text-muted-foreground text-right text-sm">
            הגדרות זמנים ומגבלות תורים
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2" dir="rtl">
              <Label
                htmlFor="appointment_duration"
                className="block text-right"
              >
                משך תור (דקות)
              </Label>
              <Select
                dir="rtl"
                value={String(localSettings.appointment_duration || 30)}
                onValueChange={(value) =>
                  onInputChange("appointment_duration", Number(value))
                }
              >
                <SelectTrigger className="text-right" dir="rtl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 דקות</SelectItem>
                  <SelectItem value="30">30 דקות</SelectItem>
                  <SelectItem value="45">45 דקות</SelectItem>
                  <SelectItem value="60">60 דקות</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_appointments" className="block text-right">
                מקסימום תורים ליום
              </Label>
              <Input
                id="max_appointments"
                type="number"
                value={localSettings.max_appointments_per_day || 20}
                onChange={(e) =>
                  onInputChange(
                    "max_appointments_per_day",
                    Number(e.target.value),
                  )
                }
                min="1"
                max="50"
                className="text-right"
                dir="rtl"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
