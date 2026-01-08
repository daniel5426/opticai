import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LookupTableManager } from "@/components/LookupTableManager"
import { lookupTables } from "@/lib/db/lookup-db"

interface FieldDataTabProps {
  currentLookupTable: string | null
  lookupData: { [key: string]: any[] }
  isLoading: boolean
  onSelectTable: (tableName: string) => void
  onRefresh: () => void
}

export function FieldDataTab({ 
  currentLookupTable, 
  lookupData, 
  isLoading,
  onSelectTable, 
  onRefresh 
}: FieldDataTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="h-fit max-h-[900px]">
          <CardHeader>
            <CardTitle className="text-right">בחר טבלת נתונים</CardTitle>
            <p className="text-sm text-muted-foreground text-right">
              בחר טבלה לעריכה וניהול הנתונים
            </p>
          </CardHeader>
          <CardContent className="overflow-y-auto" style={{scrollbarWidth: 'none'}}>
            <div className="space-y-1">
              {Object.entries(lookupTables).map(([key, table]) => (
                <div
                  key={key}
                  className={`px-3 rounded text-sm cursor-pointer text-right transition-colors flex items-center justify-end gap-2 ${
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
              onCreate={lookupTables[currentLookupTable as keyof typeof lookupTables].create}
              onUpdate={lookupTables[currentLookupTable as keyof typeof lookupTables].update}
              onDelete={lookupTables[currentLookupTable as keyof typeof lookupTables].delete}
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


