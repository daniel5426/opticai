import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function ClientBillingTab() {
  return (
    <Card className="text-right">
      <CardHeader>
        <CardTitle>חשבונות</CardTitle>
      </CardHeader>
      <CardContent>
        <p>תוכן עבור חשבונות יוצג כאן.</p>
      </CardContent>
    </Card>
  )
} 