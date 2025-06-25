import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
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
import { PlusIcon } from "lucide-react"

interface ClientsTableProps {
  data: Client[]
}

export function ClientsTable({ data }: ClientsTableProps) {
  const [filtering, setFiltering] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(0)
  const pageSize = 10
  const navigate = useNavigate()

  const filteredData = React.useMemo(() => {
    return data.filter((client) => 
      client.last_name?.toLowerCase().includes(filtering.toLowerCase()) ||
      client.first_name?.toLowerCase().includes(filtering.toLowerCase())
    )
  }, [data, filtering])

  const pageCount = Math.ceil(filteredData.length / pageSize)
  const pageData = React.useMemo(() => {
    const start = currentPage * pageSize
    const end = start + pageSize
    return filteredData.slice(start, end)
  }, [filteredData, currentPage, pageSize])

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1))
  }

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(pageCount - 1, prev + 1))
  }

  const handleRowClick = (clientId: number | undefined) => {
    if (clientId !== undefined) {
      navigate({ to: "/clients/$clientId", params: { clientId: String(clientId) }, search: { tab: "details" } })
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between py-4" dir="rtl">
        <Input
          placeholder="חיפוש לקוח..."
          value={filtering}
          onChange={(event) => {
            setFiltering(event.target.value)
            setCurrentPage(0) // Reset to first page when filtering
          }}
          className="max-w-sm"
        />
        <Button onClick={() => navigate({ to: "/clients/new" })} dir="rtl">
          לקוח חדש
          <PlusIcon className="mr-2 h-4 w-4" />
        </Button>
      </div>
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <Table className="w-full" dir="rtl">
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-[80px] text-right font-bold">מס' לקוח</TableHead>
                <TableHead className="w-[140px] text-right font-bold">שם פרטי</TableHead>
                <TableHead className="w-[140px] text-right font-bold">שם משפחה</TableHead>
                <TableHead className="w-[80px] text-right font-bold">מגדר</TableHead>
                <TableHead className="w-[120px] text-right font-bold">ת.ז.</TableHead>
                <TableHead className="w-[120px] text-right font-bold">נייד</TableHead>
                <TableHead className="text-right font-bold">אימייל</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.length ? (
                pageData.map((client) => (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer"
                    onClick={() => handleRowClick(client.id)}
                  >
                    <TableCell className="text-right font-medium">{client.id}</TableCell>
                    <TableCell className="text-right">{client.first_name || ""}</TableCell>
                    <TableCell className="text-right">{client.last_name || ""}</TableCell>
                    <TableCell className="text-right">{client.gender || ""}</TableCell>
                    <TableCell className="text-right">{client.national_id || ""}</TableCell>
                    <TableCell className="text-right">{client.phone_mobile || ""}</TableCell>
                    <TableCell className="text-right">{client.email || ""}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    לא נמצאו לקוחות.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {filteredData.length} לקוחות סה"כ
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousPage}
            disabled={currentPage === 0}
          >
            הקודם
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage >= pageCount - 1}
          >
            הבא
          </Button>
        </div>
      </div>
    </div>
  );
}