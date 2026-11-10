import { affectsFamily } from "@/lib/record-changes";
import { TableExportProvider } from "@/components/table-export/context";
import { CompanyClinicToolbarProvider } from "@/components/CompanyClinicFilter"
import { useCompanyClinicFilter } from "@/hooks/client/useCompanyClinicFilter"
import React, { useState, useEffect } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { getPaginatedAppointments } from "@/lib/db/appointments-db";
import { Appointment } from "@/lib/db/schema-interface";
import { AppointmentsTable } from "@/components/appointments-table";
import { useUser } from "@/contexts/UserContext";
import { ALL_FILTER_VALUE } from "@/lib/table-filters";
import {
  TABLE_SEARCH_DEBOUNCE_MS,
  buildTableSearch,
  useLatestTableSearchRequest,
} from "@/lib/list-page-search";
import {
  parseSortSearch,
  sortToOrder,
  sortToSearch,
} from "@/lib/table-sorting";
import { parseColumnFilters, serializeColumnFilters } from "@/lib/column-filters";
import { deferPaginationTotal } from "@/lib/deferred-pagination";

export default function AllAppointmentsPage() {
  const { currentClinic } = useUser();
  const clinicFilter = useCompanyClinicFilter()
  const search = useSearch({ from: "/appointments" });
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [searchInput, setSearchInput] = useState(search.q);
  const { startSearchRequest, updateLatestSearch } =
    useLatestTableSearchRequest(searchInput);
  const activeSort = React.useMemo(
    () => parseSortSearch(search.sort, { key: "date", direction: "desc" }),
    [search.sort],
  );
  const columnFilters = React.useMemo(() => parseColumnFilters(search.filters), [search.filters]);

  useEffect(() => {
    updateLatestSearch(search.q);
    setSearchInput((current) => (current.trim() === search.q ? current : search.q));
  }, [search.q, updateLatestSearch]);

  const handleSearchInputChange = (value: string) => {
    updateLatestSearch(value);
    setSearchInput(value);
  };

  const buildSearchState = (
    overrides?: Partial<{
      q: string;
      page: number;
      dateScope: string;
      examName: string;
      sort: string;
      filters: string;
    }>,
  ) =>
    buildTableSearch(
      {
        q: searchInput.trim(),
        page: search.page,
        dateScope: search.dateScope,
        examName: search.examName,
        sort: search.sort,
        filters: search.filters,
        ...overrides,
      },
      {
        q: "",
        page: 1,
        dateScope: ALL_FILTER_VALUE,
        examName: ALL_FILTER_VALUE,
        sort: "",
        filters: "",
      },
    );

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput.trim() === search.q) return;
      navigate({
        to: "/appointments",
        search: buildSearchState({ q: searchInput.trim(), page: 1 }),
      });
    }, TABLE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [navigate, search.q, searchInput]);

  const loadData = async (background = false) => {
    const canCommit = startSearchRequest(search.q);
    try {
      if (!background) setLoading(true);
      setTotal(null);
      const offset = (search.page - 1) * pageSize;
      const paginationOptions = {
        limit: pageSize,
        offset,
        order: sortToOrder(activeSort, "date_desc"),
        q: search.q || undefined,
        dateScope:
          search.dateScope !== ALL_FILTER_VALUE
            ? search.dateScope
            : undefined,
        examName:
          search.examName !== ALL_FILTER_VALUE ? search.examName : undefined,
        columnFilters: search.filters || undefined,
        includeTotal: false,
      };
      const { items, hasMore: nextHasMore } = await getPaginatedAppointments(
        clinicFilter.clinicId,
        paginationOptions,
      );
      if (!canCommit()) return;
      setAppointments(items);
      setHasMore(nextHasMore);
      deferPaginationTotal(
        () => getPaginatedAppointments(clinicFilter.clinicId, { ...paginationOptions, countOnly: true }),
        canCommit,
        setTotal,
      );
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      if (canCommit()) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (currentClinic) {
      loadData();
    }
  }, [
    activeSort,
    currentClinic,
    clinicFilter.clinicId,
    pageSize,
    search.dateScope,
    search.examName,
    search.page,
    search.q,
    search.filters,
    startSearchRequest,
  ]);

  useEffect(() => {
    const handleAppointmentCreated = () => {
      void loadData();
    };
    window.addEventListener("appointmentsChanged", handleAppointmentCreated);
    return () =>
      window.removeEventListener(
        "appointmentsChanged",
        handleAppointmentCreated,
      );
  }, [loadData]);

  const handleAppointmentDeleted = (deletedAppointmentId: number) => {
    setAppointments((prevAppointments) =>
      prevAppointments.filter(
        (appointment) => appointment.id !== deletedAppointmentId,
      ),
    );
    // Move to previous page if we deleted the last item on the current page
    if (appointments.length === 1 && search.page > 1) {
      navigate({
        to: "/appointments",
        search: buildSearchState({ page: search.page - 1 }),
      });
    } else {
      setTotal((prev) => (prev === null ? null : Math.max(0, prev - 1)));
    }
  };

  const handleAppointmentDeleteFailed = () => {
    loadData();
  };

  const handleAppointmentChange = () => {
    loadData();
  };

  useEffect(() => {
    const refresh = (event: Event) => { if (affectsFamily(event, "appointments")) void loadData(true) }
    window.addEventListener("prysm:client-records-changed", refresh)
    return () => window.removeEventListener("prysm:client-records-changed", refresh)
  }, [loadData])

  return (
    <TableExportProvider value={{ table: "appointments", clinicId: clinicFilter.clinicId, sort: sortToOrder(activeSort, "date_desc") }}>
    <CompanyClinicToolbarProvider filter={{ ...clinicFilter, setValue: value => { clinicFilter.setValue(value); void navigate({ to: "/appointments", search: buildSearchState({ page: 1 }) }) } }}>
      <SiteHeader title="תורים" />
      <div
        className="flex h-full min-h-0 flex-1 flex-col p-4 lg:p-6"
        dir="rtl"
        style={{ scrollbarWidth: "none" }}
      >
        <AppointmentsTable
          data={appointments}
          clientId={0}
          onAppointmentChange={handleAppointmentChange}
          onAppointmentDeleted={handleAppointmentDeleted}
          onAppointmentDeleteFailed={handleAppointmentDeleteFailed}
          searchQuery={searchInput}
          onSearchChange={handleSearchInputChange}
          serverFiltered={true}
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
          columnFilters={columnFilters}
          onColumnFiltersChange={(filters) =>
            navigate({
              to: "/appointments",
              search: buildSearchState({ filters: serializeColumnFilters(filters), page: 1 }),
            })
          }
          sort={activeSort}
          onSortChange={(sort) =>
            navigate({
              to: "/appointments",
              search: buildSearchState({ sort: sortToSearch(sort), page: 1 }),
            })
          }
          loading={loading}
          fillHeight
          pagination={{
            page: search.page,
            pageSize,
            total,
            hasMore,
            setPage: (page) =>
              navigate({
                to: "/appointments",
                search: buildSearchState({ page }),
              }),
          }}
        />
      </div>
    </CompanyClinicToolbarProvider>
    </TableExportProvider>
  );
}
