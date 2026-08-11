import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LookupTableManager } from "@/components/LookupTableManager"
import { lookupTables } from "@/lib/db/lookup-db"
import { useAppLocale } from "@/localization/use-app-locale"

interface FieldDataTabProps {
  clinicId?: number
  currentLookupTable: string | null
  lookupData: { [key: string]: any[] }
  isLoading: boolean
  onSelectTable: (tableName: string) => void
  onRefresh: () => void
}

export function FieldDataTab({ 
  clinicId,
  currentLookupTable, 
  lookupData, 
  isLoading,
  onSelectTable, 
  onRefresh 
}: FieldDataTabProps) {
  const { direction } = useAppLocale()

  return (
    <div className="space-y-6" dir={direction}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="h-fit max-h-[900px]">
          <CardHeader>
            <CardTitle className="text-start">בחר טבלת נתונים</CardTitle>
            <p className="text-start text-sm text-muted-foreground">
              בחר טבלה לעריכה וניהול הנתונים
            </p>
          </CardHeader>
          <CardContent className="overflow-y-auto" style={{scrollbarWidth: 'none'}}>
            <div className="space-y-1">
              {Object.entries(lookupTables).map(([key, table]) => (
                <div
                  key={key}
                  className={`flex items-center justify-start gap-2 rounded px-3 text-start text-sm transition-colors cursor-pointer ${
                    currentLookupTable === key 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => onSelectTable(key)}
                >
                  {currentLookupTable === key && isLoading && (
                    <div className="w-3 h-3 border border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                  )}
                  {table.displayName}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          {currentLookupTable ? (
            <LookupTableManager
              tableName={currentLookupTable}
              displayName={lookupTables[currentLookupTable as keyof typeof lookupTables].displayName}
              items={lookupData[currentLookupTable] || []}
              isLoading={isLoading}
              onRefresh={onRefresh}
              onCreate={(data) => clinicId ? lookupTables[currentLookupTable as keyof typeof lookupTables].create({ ...data, clinic_id: clinicId }) : Promise.resolve(null)}
              onUpdate={(data) => clinicId ? lookupTables[currentLookupTable as keyof typeof lookupTables].update({ ...data, clinic_id: data.clinic_id || clinicId }) : Promise.resolve(null)}
              onDelete={(id) => clinicId ? lookupTables[currentLookupTable as keyof typeof lookupTables].delete(id, clinicId) : Promise.resolve(false)}
            />
          ) : (
            <Card className="">
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center text-muted-foreground">
                  <p className="text-lg mb-2">בחר טבלת נתונים לעריכה</p>
                  <p className="text-sm">בחר טבלה מהרשימה מימין כדי להתחיל לערוך</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
