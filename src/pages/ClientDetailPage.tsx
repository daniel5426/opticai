import React, { useState, useRef, useEffect } from "react"
import { useParams } from "@tanstack/react-router"
import { SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { SiteHeader } from "@/components/site-header"
import { getClientById, updateClient } from "@/lib/db/clients-db"
import { Client } from "@/lib/db/schema"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

export default function ClientDetailPage() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const [client, setClient] = useState<Client | undefined>(getClientById(Number(clientId)))
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Client>({} as Client)
  const formRef = useRef<HTMLFormElement>(null)
  
  useEffect(() => {
    if (client) {
      setFormData({ ...client })
    }
  }, [client])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (value: string, name: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }
  
  const handleSave = () => {
    if (formRef.current) {
      // Update client data in the database
      const updatedClient = updateClient(formData)
      
      if (updatedClient) {
        setClient(updatedClient)
        setIsEditing(false)
        toast.success("פרטי הלקוח עודכנו בהצלחה")
      } else {
        toast.error("לא הצלחנו לשמור את השינויים")
      }
    }
  }
  
  if (!client) {
    return (
      <SidebarProvider dir="rtl">
        <AppSidebar variant="inset" side="right" />
        <SidebarInset>
          <SiteHeader title="לקוחות" backLink="/clients" />
          <div className="flex flex-col items-center justify-center h-full">
            <h1 className="text-2xl">לקוח לא נמצא</h1>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  const fullName = `${client.first_name} ${client.last_name}`.trim()
  
  return (
    <SidebarProvider dir="rtl">
      <AppSidebar variant="inset" side="right" />
      <SidebarInset>
        <SiteHeader 
          title="לקוחות" 
          backLink="/clients"
          clientName={fullName}
        />
        <div className="flex flex-col flex-1 p-4 lg:p-6" dir="rtl">
          <Tabs defaultValue="details" className="w-full">
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="details">פרטים אישיים</TabsTrigger>
                <TabsTrigger value="exams">בדיקות</TabsTrigger>
                <TabsTrigger value="orders">הזמנות</TabsTrigger>
                <TabsTrigger value="billing">חשבונות</TabsTrigger>
              </TabsList>
              <Button 
                variant={isEditing ? "outline" : "default"} 
                onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              >
                {isEditing ? "שמור שינויים" : "ערוך פרטים"}
              </Button>
            </div>
            
            <TabsContent value="details">
              <form ref={formRef}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="text-right">
                    <CardHeader>
                      <CardTitle>פרטים אישיים</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4" dir="rtl">
                      <div>
                        <Label>שם פרטי</Label>
                        {isEditing ? (
                          <Input 
                            type="text"
                            name="first_name"
                            value={formData.first_name || ''}
                            onChange={handleInputChange}
                            className="mt-1"
                          />
                        ) : (
                          <div>{client.first_name}</div>
                        )}
                      </div>
                      <div>
                        <Label>שם משפחה</Label>
                        {isEditing ? (
                          <Input 
                            type="text"
                            name="last_name"
                            value={formData.last_name || ''}
                            onChange={handleInputChange}
                            className="mt-1"
                          />
                        ) : (
                          <div>{client.last_name}</div>
                        )}
                      </div>
                      <div>
                        <Label>מגדר</Label>
                        {isEditing ? (
                          <Select 
                            value={formData.gender || ''} 
                            onValueChange={(value) => handleSelectChange(value, 'gender')}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="בחר מגדר" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="זכר">זכר</SelectItem>
                              <SelectItem value="נקבה">נקבה</SelectItem>
                              <SelectItem value="אחר">אחר</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div>{client.gender}</div>
                        )}
                      </div>
                      <div>
                        <Label>תעודת זהות</Label>
                        {isEditing ? (
                          <Input 
                            type="text"
                            name="national_id"
                            value={formData.national_id || ''}
                            onChange={handleInputChange}
                            className="mt-1"
                          />
                        ) : (
                          <div>{client.national_id}</div>
                        )}
                      </div>
                      <div>
                        <Label>תאריך לידה</Label>
                        {isEditing ? (
                          <Input 
                            type="date"
                            name="date_of_birth"
                            value={formData.date_of_birth || ''}
                            onChange={handleInputChange}
                            className="mt-1"
                          />
                        ) : (
                          <div>{client.date_of_birth}</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="text-right">
                    <CardHeader>
                      <CardTitle>פרטי התקשרות</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4" dir="rtl">
                      <div>
                        <Label>עיר</Label>
                        {isEditing ? (
                          <Input 
                            type="text"
                            name="address_city"
                            value={formData.address_city || ''}
                            onChange={handleInputChange}
                            className="mt-1"
                          />
                        ) : (
                          <div>{client.address_city}</div>
                        )}
                      </div>
                      <div>
                        <Label>רחוב</Label>
                        {isEditing ? (
                          <Input 
                            type="text"
                            name="address_street"
                            value={formData.address_street || ''}
                            onChange={handleInputChange}
                            className="mt-1"
                          />
                        ) : (
                          <div>{client.address_street}</div>
                        )}
                      </div>
                      <div>
                        <Label>מספר</Label>
                        {isEditing ? (
                          <Input 
                            type="text"
                            name="address_number"
                            value={formData.address_number || ''}
                            onChange={handleInputChange}
                            className="mt-1"
                          />
                        ) : (
                          <div>{client.address_number}</div>
                        )}
                      </div>
                      <div>
                        <Label>מיקוד</Label>
                        {isEditing ? (
                          <Input 
                            type="text"
                            name="postal_code"
                            value={formData.postal_code || ''}
                            onChange={handleInputChange}
                            className="mt-1"
                          />
                        ) : (
                          <div>{client.postal_code}</div>
                        )}
                      </div>
                      <div>
                        <Label>טלפון נייד</Label>
                        {isEditing ? (
                          <Input 
                            type="tel"
                            name="phone_mobile"
                            value={formData.phone_mobile || ''}
                            onChange={handleInputChange}
                            className="mt-1"
                          />
                        ) : (
                          <div>{client.phone_mobile}</div>
                        )}
                      </div>
                      <div>
                        <Label>טלפון בית</Label>
                        {isEditing ? (
                          <Input 
                            type="tel"
                            name="phone_home"
                            value={formData.phone_home || ''}
                            onChange={handleInputChange}
                            className="mt-1"
                          />
                        ) : (
                          <div>{client.phone_home}</div>
                        )}
                      </div>
                      <div>
                        <Label>טלפון עבודה</Label>
                        {isEditing ? (
                          <Input 
                            type="tel"
                            name="phone_work"
                            value={formData.phone_work || ''}
                            onChange={handleInputChange}
                            className="mt-1"
                          />
                        ) : (
                          <div>{client.phone_work}</div>
                        )}
                      </div>
                      <div>
                        <Label>אימייל</Label>
                        {isEditing ? (
                          <Input 
                            type="email"
                            name="email"
                            value={formData.email || ''}
                            onChange={handleInputChange}
                            className="mt-1"
                          />
                        ) : (
                          <div>{client.email}</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="exams">
              <Card className="text-right">
                <CardHeader>
                  <CardTitle>בדיקות</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>תוכן עבור בדיקות יוצג כאן.</p>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="orders">
              <Card className="text-right">
                <CardHeader>
                  <CardTitle>הזמנות</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>תוכן עבור הזמנות יוצג כאן.</p>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="billing">
              <Card className="text-right">
                <CardHeader>
                  <CardTitle>חשבונות</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>תוכן עבור חשבונות יוצג כאן.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 