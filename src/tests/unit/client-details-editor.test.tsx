import React from "react"
import { render as renderUi, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { ClientDetailsTab } from "@/components/client/ClientDetailsTab"
import { Client } from "@/lib/db/schema-interface"
import {
  buildClientUpdatePayload,
  getClientGenderLabel,
  normalizeClientForDraft,
  serializeClientDraftForUnsavedChanges,
  shouldClearStatusForHealthFund,
} from "@/lib/client-details-editor"

// The notifications Switch measures itself; jsdom has no ResizeObserver.
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })

const { getPaginatedFamiliesMock } = vi.hoisted(() => ({
  getPaginatedFamiliesMock: vi.fn(() => Promise.resolve({
    items: [{
      id: 42,
      name: "כהן",
      clients: [{ id: 7, first_name: "דנה", last_name: "כהן" }],
    }],
    total: null,
    hasMore: false,
  })),
}))

vi.mock("@/lib/db/family-db", () => ({
  getPaginatedFamilies: getPaginatedFamiliesMock,
  getFamilyById: vi.fn(() => Promise.resolve(null)),
  createFamily: vi.fn(),
  addClientToFamily: vi.fn(),
  removeClientFromFamily: vi.fn(),
}))

vi.mock("@/components/migration/ImportedSourceDataDialog", () => ({
  ImportedSourceDataDialog: () => null,
}))

vi.mock("@/lib/api-client", () => ({
  apiClient: { getImportedProfileHistory: vi.fn().mockResolvedValue({data:{available:false,values:{}}}), getClientExamDates: vi.fn(() => Promise.resolve({ data: { first_exam_date: null, last_exam_date: null } })) },
}))

// The tab reads exam dates through React Query, which the app provides at its root.
const render = (ui: React.ReactElement) =>
  renderUi(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {children}
      </QueryClientProvider>
    ),
  })

describe("client details editor helpers", () => {
  test("normalizes legacy loaded client values at the boundary", () => {
    const draft = normalizeClientForDraft({
      id: 1,
      gender: " female ",
      health_fund: " maccabi ",
      status: " זהב ",
    } as Client)

    expect(draft.gender).toBe("נקבה")
    expect(draft.health_fund).toBe("מכבי")
    expect(draft.status).toBe("זהב")
  })

  test("presents persisted gender values in the active locale", () => {
    expect(getClientGenderLabel("נקבה", "he")).toBe("נקבה")
    expect(getClientGenderLabel("female", "en")).toBe("female")
    expect(getClientGenderLabel("m", "fr")).toBe("homme")
  })

  test("builds a cleaned full update payload from server data and draft edits", () => {
    const payload = buildClientUpdatePayload(
      {
        id: 1,
        first_name: " דנה ",
        last_name: " כהן ",
        email: " dana@example.com ",
        additional_phone: "03-5555555",
        gender: "female",
        health_fund: "כללית",
        status: "רגיל",
      } as Client,
      {
        id: 1,
        first_name: " דניאל ",
        gender: " male ",
        health_fund: " clalit ",
        status: " מושלם זהב ",
      } as Client
    )

    expect(payload).toMatchObject({
      id: 1,
      first_name: "דניאל",
      last_name: "כהן",
      email: "dana@example.com",
      additional_phone: "03-5555555",
      gender: "זכר",
      health_fund: "כללית",
      status: "מושלם זהב",
    })
  })

  test("only clears status when it is invalid for a manually changed health fund", () => {
    expect(shouldClearStatusForHealthFund("רגיל", "מכבי")).toBe(false)
    expect(shouldClearStatusForHealthFund("מושלם פלטינום", "מכבי")).toBe(true)
    expect(shouldClearStatusForHealthFund("", "מכבי")).toBe(false)
  })

  test("serializes client drafts with stable keys and trimmed text", () => {
    const first = serializeClientDraftForUnsavedChanges({
      last_name: " כהן ",
      first_name: "דנה",
      email: "",
    } as Client)
    const second = serializeClientDraftForUnsavedChanges({
      first_name: "דנה",
      last_name: "כהן",
    } as Client)

    expect(first).toBe(second)
  })
})

describe("ClientDetailsTab select display", () => {
  test("does not load family records until the picker is opened", () => {
    render(
      <ClientDetailsTab
        draft={{ id: 1 } as Client}
        isEditing={false}
        formRef={{ current: null }}
        onFieldChange={vi.fn()}
      />
    )

    expect(getPaginatedFamiliesMock).not.toHaveBeenCalled()
  })

  test("renders loaded gender, health fund, and status from the controlled draft", async () => {
    const draft = {
      id: 1,
      first_name: "דנה",
      last_name: "כהן",
      gender: "נקבה",
      health_fund: "כללית",
      status: "מושלם זהב",
    } as Client

    render(
      <ClientDetailsTab
        draft={draft}
        isEditing={false}
        formRef={{ current: null }}
        onFieldChange={vi.fn()}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getAllByText("נקבה").length).toBeGreaterThan(0)
      expect(screen.getAllByText("כללית").length).toBeGreaterThan(0)
      expect(screen.getAllByText("מושלם זהב").length).toBeGreaterThan(0)
    })
  })

  test("notifications switch is off by default and edits send_notifications", async () => {
    const onFieldChange = vi.fn()
    render(
      <ClientDetailsTab draft={{ id: 1 } as Client} isEditing formRef={{ current: null }} onFieldChange={onFieldChange} />
    )
    const toggle = screen.getByRole("switch", { name: /קבלת התראות|clientSendNotifications/ })
    expect(toggle).toHaveAttribute("aria-checked", "false")
    await userEvent.click(toggle)
    expect(onFieldChange).toHaveBeenCalledWith("send_notifications", true)
  })

  test("keeps the address number input while hiding the additional phone input", () => {
    render(
      <ClientDetailsTab
        draft={{ id: 1, additional_phone: "03-5555555", address_number: "12/4" } as Client}
        isEditing={false}
        formRef={{ current: null }}
        onFieldChange={vi.fn()}
        onStartEdit={vi.fn()}
        onSave={vi.fn()}
      />
    )
    expect(screen.getByDisplayValue("12/4")).toHaveAttribute("name", "address_number")
    expect(screen.queryByDisplayValue("03-5555555")).not.toBeInTheDocument()
  })

  test("the fax field shows only for a client with a fax, editing or not", () => {
    const props = { formRef: { current: null }, onFieldChange: vi.fn() }
    const view = render(<ClientDetailsTab draft={{ id: 1 } as Client} isEditing={false} {...props} />)
    expect(document.querySelector('input[name="fax"]')).toBeNull()
    view.rerender(<ClientDetailsTab draft={{ id: 1 } as Client} isEditing {...props} />)
    expect(document.querySelector('input[name="fax"]')).toBeNull()
    view.unmount()

    const withFax = render(<ClientDetailsTab draft={{ id: 2, fax: "03-1234567" } as Client} isEditing={false} {...props} />)
    expect(screen.getByDisplayValue("03-1234567")).toHaveAttribute("name", "fax")
    // Clearing it while editing keeps the field.
    withFax.rerender(<ClientDetailsTab draft={{ id: 2, fax: "" } as Client} isEditing {...props} />)
    expect(document.querySelector('input[name="fax"]')).not.toBeNull()
  })

  test("selecting a family emits a numeric family_id for new-client drafts", async () => {
    const onFieldChange = vi.fn()

    render(
      <ClientDetailsTab
        draft={{} as Client}
        isEditing={false}
        mode="new"
        formRef={{ current: null }}
        onFieldChange={onFieldChange}
      />
    )

    await userEvent.click(screen.getByRole("combobox", { name: "משפחה" }))
    expect(await screen.findByText("דנה כהן")).toBeInTheDocument()
    expect(getPaginatedFamiliesMock).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ limit: 25, includeTotal: false })
    )
    await userEvent.click(await screen.findByText("כהן"))

    expect(onFieldChange).toHaveBeenCalledWith("family_id", 42)
    expect(onFieldChange).toHaveBeenCalledWith("family_role", "אחר")
  })
})

for (const locale of ['he', 'en', 'fr']) {
  test(`home/work tabs retain independent edits and align telephone and fax values in ${locale}`, async () => {
    const {default:i18n} = await import('@/localization/i18n');
    await i18n.changeLanguage(locale);
    function ContactHarness() {
      const [draft, setDraft] = React.useState({id:1,phone_home:'02-1111111',phone_work:'02-2222222',fax:'02-3333333'} as Client);
      return <ClientDetailsTab draft={draft} isEditing formRef={{current:null}}
        onFieldChange={(field,value)=>setDraft(previous=>({...previous,[field]:value}))} />;
    }
    const {container} = render(<ContactHarness />);
    const home = await screen.findByRole('textbox',{name:i18n.t('clientContact.homePhone')});
    await userEvent.clear(home); await userEvent.type(home,'02-4444444');
    await userEvent.click(screen.getByRole('tab',{name:i18n.t('clientContact.work'),exact:true}));
    const work=screen.getByRole('textbox',{name:i18n.t('clientContact.workPhone')});
    expect(work).toHaveValue('02-2222222');
    await userEvent.clear(work); await userEvent.type(work,'02-5555555');
    await userEvent.click(screen.getByRole('tab',{name:i18n.t('clientContact.home'),exact:true}));
    expect(screen.getByRole('textbox',{name:i18n.t('clientContact.homePhone')})).toHaveValue('02-4444444');
    expect(container.querySelector('input[name="fax"]')).toHaveValue('02-3333333');
    expect(container.querySelector('input[name="fax"]')).toHaveAttribute('dir','ltr');
    expect(container.querySelector('input[name="fax"]')).toHaveClass(locale==='he'?'text-right':'text-left');
  });
}
