import React from "react"
import { useNavigate } from "@tanstack/react-router"
import { SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/db/clients-db"
import { Client } from "@/lib/db/schema"

export default function NewClientPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = React.useState<Partial<Client>>({
    gender: "זכר",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleGenderChange = (value: string) => {
    setFormData((prev) => ({ ...prev, gender: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newClient = createClient(formData as Client)
    navigate({ to: "/clients/$clientId", params: { clientId: newClient.id } })
  }

  return (
    <SidebarProvider dir="rtl">
      <AppSidebar variant="inset" side="right" />
      <SidebarInset>
        <SiteHeader title="לקוחות" backLink="/clients" clientName="לקוח חדש" />
        <div className="flex flex-col flex-1 p-4 lg:p-6">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>פרטים אישיים</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">שם פרטי</Label>
                    <Input 
                      id="first_name" 
                      name="first_name" 
                      value={formData.first_name || ""} 
                      onChange={handleChange} 
                      required 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="last_name">שם משפחה</Label>
                    <Input 
                      id="last_name" 
                      name="last_name" 
                      value={formData.last_name || ""} 
                      onChange={handleChange} 
                      required 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="gender">מגדר</Label>
                    <Select 
                      onValueChange={handleGenderChange} 
                      defaultValue={formData.gender}
                    >
                      <SelectTrigger id="gender">
                        <SelectValue placeholder="בחר מגדר" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="זכר">זכר</SelectItem>
                        <SelectItem value="נקבה">נקבה</SelectItem>
                        <SelectItem value="אחר">אחר</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="national_id">תעודת זהות</Label>
                    <Input 
                      id="national_id" 
                      name="national_id" 
                      value={formData.national_id || ""} 
                      onChange={handleChange} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">תאריך לידה</Label>
                    <Input 
                      id="date_of_birth" 
                      name="date_of_birth" 
                      type="date" 
                      value={formData.date_of_birth || ""} 
                      onChange={handleChange} 
                    />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>פרטי התקשרות</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address_city">עיר</Label>
                    <Input 
                      id="address_city" 
                      name="address_city" 
                      value={formData.address_city || ""} 
                      onChange={handleChange} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="address_street">רחוב</Label>
                    <Input 
                      id="address_street" 
                      name="address_street" 
                      value={formData.address_street || ""} 
                      onChange={handleChange} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="address_number">מספר</Label>
                    <Input 
                      id="address_number" 
                      name="address_number" 
                      value={formData.address_number || ""} 
                      onChange={handleChange} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="postal_code">מיקוד</Label>
                    <Input 
                      id="postal_code" 
                      name="postal_code" 
                      value={formData.postal_code || ""} 
                      onChange={handleChange} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone_mobile">טלפון נייד</Label>
                    <Input 
                      id="phone_mobile" 
                      name="phone_mobile" 
                      value={formData.phone_mobile || ""} 
                      onChange={handleChange} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone_home">טלפון בית</Label>
                    <Input 
                      id="phone_home" 
                      name="phone_home" 
                      value={formData.phone_home || ""} 
                      onChange={handleChange} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone_work">טלפון עבודה</Label>
                    <Input 
                      id="phone_work" 
                      name="phone_work" 
                      value={formData.phone_work || ""} 
                      onChange={handleChange} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">אימייל</Label>
                    <Input 
                      id="email" 
                      name="email" 
                      type="email" 
                      value={formData.email || ""} 
                      onChange={handleChange} 
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="flex justify-end mt-6">
              <Button 
                type="button" 
                variant="outline" 
                className="ml-2"
                onClick={() => navigate({ to: "/clients" })}
              >
                ביטול
              </Button>
              <Button type="submit">שמירה</Button>
            </div>
          </form>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 