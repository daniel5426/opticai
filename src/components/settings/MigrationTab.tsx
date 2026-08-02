import React, { useState } from "react"
import { ArrowRight, Database } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SoftOpticMigrationTab } from "@/components/settings/SoftOpticMigrationTab"

type MigrationSource = "softoptic" | "optitech"

export function MigrationTab({ clinicId }: { clinicId?: number }) {
  const [source, setSource] = useState<MigrationSource | null>(null)

  if (source) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setSource(null)}>
          <ArrowRight className="ml-2 h-4 w-4" />
          בחירת מערכת אחרת
        </Button>
        <SoftOpticMigrationTab clinicId={clinicId} sourceSystem={source} />
      </div>
    )
  }

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle className="text-right">מאיזו מערכת להעביר נתונים?</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <button type="button" onClick={() => setSource("softoptic")} className="rounded-lg border p-5 text-right transition-colors hover:border-primary hover:bg-primary/5">
          <Database className="mb-4 h-7 w-7 text-primary" />
          <div className="font-semibold">אופטיק-סופט</div>
          <p className="mt-1 text-sm text-muted-foreground">איתור SQL Anywhere והעברת נתוני המרפאה.</p>
        </button>
        <button type="button" onClick={() => setSource("optitech")} className="rounded-lg border p-5 text-right transition-colors hover:border-primary hover:bg-primary/5">
          <Database className="mb-4 h-7 w-7 text-primary" />
          <div className="font-semibold">OptiTech</div>
          <p className="mt-1 text-sm text-muted-foreground">איתור optData.xns והעברת הנתונים והסריקות.</p>
        </button>
      </CardContent>
    </Card>
  )
}
