import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { ArrowRight, Database } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SoftOpticMigrationTab } from "@/components/settings/SoftOpticMigrationTab"
import { OpticPlusMigrationTab } from "@/components/settings/OpticPlusMigrationTab"

type MigrationSource = "softoptic" | "optitech" | "opticplus"

export function MigrationTab({ clinicId }: { clinicId?: number }) {
  const { t, i18n } = useTranslation()
  const [source, setSource] = useState<MigrationSource | null>(null)

  if (source) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setSource(null)}>
          <ArrowRight className="me-2 h-4 w-4" />
          {t("opticplus.selectOther")}
        </Button>
        {source === "opticplus" ? <OpticPlusMigrationTab key={clinicId} clinicId={clinicId} /> : <SoftOpticMigrationTab clinicId={clinicId} sourceSystem={source} />}
      </div>
    )
  }

  return (
    <Card dir={i18n.dir()}>
      <CardHeader>
        <CardTitle className="text-start">{t("opticplus.selectSystem")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <button type="button" onClick={() => setSource("softoptic")} className="rounded-lg border p-5 text-start transition-colors hover:border-primary hover:bg-primary/5">
          <Database className="mb-4 h-7 w-7 text-primary" />
          <div className="font-semibold">{t("opticplus.softopticName")}</div>
          <p className="mt-1 text-sm text-muted-foreground">{t("opticplus.softopticDescription")}</p>
        </button>
        <button type="button" onClick={() => setSource("optitech")} className="rounded-lg border p-5 text-start transition-colors hover:border-primary hover:bg-primary/5">
          <Database className="mb-4 h-7 w-7 text-primary" />
          <div className="font-semibold">OptiTech</div>
          <p className="mt-1 text-sm text-muted-foreground">{t("opticplus.optitechDescription")}</p>
        </button>
        <button type="button" onClick={() => setSource("opticplus")} className="rounded-lg border p-5 text-start transition-colors hover:border-primary hover:bg-primary/5">
          <Database className="mb-4 h-7 w-7 text-primary" />
          <div className="font-semibold">OpticPlus</div>
          <p className="mt-1 text-sm text-muted-foreground">{t("opticplus.description")}</p>
        </button>
      </CardContent>
    </Card>
  )
}
