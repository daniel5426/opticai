import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
import { Client } from "@/lib/db/schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PlusIcon, Trash2 } from "lucide-react"
import { CustomModal } from "@/components/ui/custom-modal"
import { deleteClient } from "@/lib/db/clients-db"
import { toast } from "sonner"

interface ClientsTableProps {
  data: Client[]
  onClientDeleted?: (clientId: number) => void
  onClientDeleteFailed?: () => void
}

export function ClientsTable({ data, onClientDeleted, onClientDeleteFailed }: ClientsTableProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false)
  const [clientToDelete, setClientToDelete] = React.useState<Client | null>(null)
  const navigate = useNavigate()

  const filteredData = React.useMemo(() => {
    return data.filter((client) => {
      const searchableFields = [
        client.first_name,
        client.last_name,
        client.national_id,
        client.phone_mobile,
        client.email,
      ]

      return searchableFields.some(
        (field) =>
          field && field.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    })
  }, [data, searchQuery])

  const handleDeleteConfirm = async () => {
    if (clientToDelete && clientToDelete.id !== undefined) {
      try {
        const deletedClientId = clientToDelete.id
        onClientDeleted?.(deletedClientId)
        toast.success("לקוח נמחק בהצלחה")

        const success = await deleteClient(deletedClientId)
        if (!success) {
          toast.error("אירעה שגיאה בעת מחיקת הלקוח. מרענן נתונים...")
          onClientDeleteFailed?.()
        }
      } catch (error) {
        toast.error("אירעה שגיאה בעת מחיקת הלקוח")
        onClientDeleteFailed?.()
      } finally {
        setClientToDelete(null)
      }
    }
    setIsDeleteModalOpen(false)
  }

  const handleRowClick = (clientId: number | undefined) => {
    if (clientId !== undefined) {
      navigate({ to: "/clients/$clientId", params: { clientId: String(clientId) }, search: { tab: "details" } })
    }
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Input
            placeholder="חיפוש לקוחות..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[250px] bg-card dark:bg-card"
            dir="rtl"
          />
        </div>
        <Button onClick={() => navigate({ to: "/clients/new" })} dir="rtl">
          לקוח חדש
          <PlusIcon className="mr-2 h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">מס' לקוח</TableHead>
              <TableHead className="text-right">שם פרטי</TableHead>
              <TableHead className="text-right">שם משפחה</TableHead>
              <TableHead className="text-right">מגדר</TableHead>
              <TableHead className="text-right">ת.ז.</TableHead>
              <TableHead className="text-right">נייד</TableHead>
              <TableHead className="text-right">אימייל</TableHead>
              <TableHead className="w-[50px] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length > 0 ? (
              filteredData.map((client) => (
                <TableRow
                  key={client.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(client.id)}
                >
                  <TableCell className="font-medium">{client.id}</TableCell>
                  <TableCell>{client.first_name || ""}</TableCell>
                  <TableCell>{client.last_name || ""}</TableCell>
                  <TableCell>{client.gender || ""}</TableCell>
                  <TableCell>{client.national_id || ""}</TableCell>
                  <TableCell>{client.phone_mobile || ""}</TableCell>
                  <TableCell>{client.email || ""}</TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      className="h-8 w-8 p-0" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setClientToDelete(client);
                        setIsDeleteModalOpen(true);
                      }} 
                      title="מחיקה"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  לא נמצאו לקוחות לתצוגה
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <CustomModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="מחיקת לקוח"
        description={clientToDelete ? `האם אתה בטוח שברצונך למחוק את הלקוח ${clientToDelete.first_name} ${clientToDelete.last_name}? פעולה זו אינה הפיכה.` : "האם אתה בטוח שברצונך למחוק לקוח זה? פעולה זו אינה הפיכה."}
        onConfirm={handleDeleteConfirm}
        confirmText="מחק"
        className="text-center"
        cancelText="בטל"
        showCloseButton={false}
      />
    </div>
  )
}