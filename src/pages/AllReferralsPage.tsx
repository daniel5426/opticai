import React, { useState, useEffect } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { getPaginatedReferrals } from "@/lib/db/referral-db"
import { Referral } from "@/lib/db/schema-interface"
import { ReferralTable } from "@/components/referral-table"
import { useUser } from "@/contexts/UserContext"
import { ALL_FILTER_VALUE } from "@/lib/table-filters"
import { buildTableSearch } from "@/lib/list-page-search"

export default function AllReferralsPage() {
  const { currentClinic } = useUser()
  const search = useSearch({ from: "/referrals" })
  const navigate = useNavigate()
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState(search.q)

  useEffect(() => {
    setSearchInput(search.q)
  }, [search.q])

  const buildSearchState = (overrides?: Partial<{ q: string; page: number; urgency: string; referralType: string }>) =>
    buildTableSearch(
      {
        q: searchInput.trim(),
        page: search.page,
        urgency: search.urgency,
        referralType: search.referralType,
        ...overrides,
      },
      {
        q: "",
        page: 1,
        urgency: ALL_FILTER_VALUE,
        referralType: ALL_FILTER_VALUE,
      },
    )

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput === search.q) return
      navigate({
        to: "/referrals",
        search: buildSearchState({ q: searchInput.trim(), page: 1 }),
      })
    }, 400)
    return () => clearTimeout(t)
  }, [navigate, search.q, searchInput])

  const loadData = async () => {
    try {
      setLoading(true)
      const offset = (search.page - 1) * pageSize
      const { items, total } = await getPaginatedReferrals(currentClinic?.id, {
        limit: pageSize,
        offset,
        order: 'date_desc',
        q: search.q || undefined,
        urgencyLevel: search.urgency !== ALL_FILTER_VALUE ? search.urgency : undefined,
        referralType: search.referralType !== ALL_FILTER_VALUE ? search.referralType : undefined,
      })
      setReferrals(items)
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
  }, [currentClinic, pageSize, search.page, search.q, search.referralType, search.urgency])

  const handleReferralDeleted = (deletedReferralId: number) => {
    setReferrals(prevReferrals => prevReferrals.filter(referral => referral.id !== deletedReferralId))
    // Move to previous page if we deleted the last item on the current page
    if (referrals.length === 1 && search.page > 1) {
      navigate({
        to: "/referrals",
        search: buildSearchState({ page: search.page - 1 }),
      })
    } else {
      setTotal(prev => prev - 1)
    }
  }

  const handleReferralDeleteFailed = () => {
    loadData()
  }

  return (
    <>
      <SiteHeader title="הפניות" />
      <div className="flex flex-col flex-1 p-4 lg:p-6" dir="rtl" style={{scrollbarWidth: 'none'}}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">כל ההפניות</h1>
        </div>
        <ReferralTable 
          referrals={referrals} 
          onReferralDeleted={handleReferralDeleted} 
          onReferralDeleteFailed={handleReferralDeleteFailed}
          clientId={0}
          loading={loading}
          searchQuery={searchInput}
          onSearchChange={setSearchInput}
          urgencyFilter={search.urgency}
          onUrgencyFilterChange={(value) =>
            navigate({
              to: "/referrals",
              search: buildSearchState({ urgency: value, page: 1 }),
            })
          }
          referralTypeFilter={search.referralType}
          onReferralTypeFilterChange={(value) =>
            navigate({
              to: "/referrals",
              search: buildSearchState({ referralType: value, page: 1 }),
            })
          }
          pagination={{
            page: search.page,
            pageSize,
            total,
            setPage: (page) =>
              navigate({
                to: "/referrals",
                search: buildSearchState({ page }),
              }),
          }}
        />
      </div>
    </>
  )
} 
