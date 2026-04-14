import React, { useState, useEffect } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { getPaginatedAppointments } from "@/lib/db/appointments-db"
import { Appointment } from "@/lib/db/schema-interface"
import { AppointmentsTable } from "@/components/appointments-table"
import { useUser } from "@/contexts/UserContext"
import { ALL_FILTER_VALUE } from "@/lib/table-filters"
import { buildTableSearch } from "@/lib/list-page-search"

export default function AllAppointmentsPage() {
  const { currentClinic } = useUser()
  const search = useSearch({ from: "/appointments" })
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState(search.q)

  useEffect(() => {
    setSearchInput(search.q)
  }, [search.q])

  const buildSearchState = (overrides?: Partial<{ q: string; page: number; dateScope: string; examName: string }>) =>
    buildTableSearch(
      {
        q: searchInput.trim(),
        page: search.page,
        dateScope: search.dateScope,
        examName: search.examName,
        ...overrides,
      },
      {
        q: "",
        page: 1,
        dateScope: ALL_FILTER_VALUE,
        examName: ALL_FILTER_VALUE,
      },
    )

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput === search.q) return
      navigate({
        to: "/appointments",
        search: buildSearchState({ q: searchInput.trim(), page: 1 }),
      })
    }, 400)
    return () => clearTimeout(t)
  }, [navigate, search.q, searchInput])

  const loadData = async () => {
    try {
      setLoading(true)
      const offset = (search.page - 1) * pageSize
      const { items, total } = await getPaginatedAppointments(currentClinic?.id, {
        limit: pageSize,
        offset,
        order: 'date_desc',
        q: search.q || undefined,
        dateScope: search.dateScope !== ALL_FILTER_VALUE ? search.dateScope : undefined,
        examName: search.examName !== ALL_FILTER_VALUE ? search.examName : undefined,
      })
      setAppointments(items)
      setTotal(total)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentClinic) {
      loadData()
    }
  }, [currentClinic, pageSize, search.dateScope, search.examName, search.page, search.q])

  const handleAppointmentDeleted = (deletedAppointmentId: number) => {
    setAppointments(prevAppointments => prevAppointments.filter(appointment => appointment.id !== deletedAppointmentId))
    // Move to previous page if we deleted the last item on the current page
    if (appointments.length === 1 && search.page > 1) {
      navigate({
        to: "/appointments",
        search: buildSearchState({ page: search.page - 1 }),
      })
    } else {
      setTotal(prev => prev - 1)
    }
  }

  const handleAppointmentDeleteFailed = () => {
    loadData()
  }

  const handleAppointmentChange = () => {
    loadData()
  }

  return (
    <>
      <SiteHeader title="תורים" />
      <div className="flex flex-col flex-1 p-4 lg:p-6" dir="rtl" style={{scrollbarWidth: 'none'}}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">כל התורים</h1>
        </div>
        <AppointmentsTable 
          data={appointments} 
          clientId={0} 
          onAppointmentChange={handleAppointmentChange}
          onAppointmentDeleted={handleAppointmentDeleted}
          onAppointmentDeleteFailed={handleAppointmentDeleteFailed}
          searchQuery={searchInput}
          onSearchChange={setSearchInput}
          dateScopeFilter={search.dateScope}
          onDateScopeFilterChange={(value) =>
            navigate({
              to: "/appointments",
              search: buildSearchState({ dateScope: value, page: 1 }),
            })
          }
          examTypeFilter={search.examName}
          onExamTypeFilterChange={(value) =>
            navigate({
              to: "/appointments",
              search: buildSearchState({ examName: value, page: 1 }),
            })
          }
          loading={loading}
          pagination={{
            page: search.page,
            pageSize,
            total,
            setPage: (page) =>
              navigate({
                to: "/appointments",
                search: buildSearchState({ page }),
              }),
          }}
        />
      </div>
    </>
  )
} 
