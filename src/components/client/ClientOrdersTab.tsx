import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function ClientOrdersTab() {
  return (
    <Card className="text-right">
      <CardHeader>
        <CardTitle>הזמנות</CardTitle>
      </CardHeader>
      <CardContent>
        <p>תוכן עבור הזמנות יוצג כאן.</p>
      </CardContent>
    </Card>
  )
} 