/**
 * OpticSoft's exam tabs, used to show an imported SoftOptic exam the way OpticSoft did.
 * This is a view over the exam's existing cards: a card may sit in several tabs (OpticSoft shares
 * them too, e.g. Uncorrected VA), and every tab edits the same stored component.
 */

type CardDef = { id: string; type: string }

export const SOFTOPTIC_EXAM_TABS = [
  "objective",
  "anamnesa",
  "oldRef3",
  "oldRef2",
  "oldRef1",
  "summary",
  "amslerGrid",
  "fundus",
  "bioMicroscopy",
  "bino",
  "subjective",
] as const

export type SoftopticExamTab = (typeof SOFTOPTIC_EXAM_TABS)[number]

/** OpticSoft's contact lens fit screen, for imported "contact_fit" exams. */
export const SOFTOPTIC_FIT_TABS = ["subjective", "bioM", "rxCl1", "rxCl2", "fitting", "observation", "bino"] as const
export type SoftopticFitTab = (typeof SOFTOPTIC_FIT_TABS)[number]
/** Cards no OpticSoft tab covers get their own trailing tab, so imported data is never hidden. */
export const SOFTOPTIC_MORE_TAB = "more"
/** The exam day's contact lens prescription, which older imports keep on the contact lens order. */
export const SOFTOPTIC_CONTACT_LENS_TAB = "contactLens"
export type SoftopticTabKey = SoftopticExamTab | SoftopticFitTab | typeof SOFTOPTIC_MORE_TAB | typeof SOFTOPTIC_CONTACT_LENS_TAB

const OLD_REF_TABS: Partial<Record<SoftopticExamTab, number>> = { oldRef1: 1, oldRef2: 2, oldRef3: 3 }
const OLD_REFRACTION_TYPES = ["old-refraction-extension", "old-refraction"]
const OLD_REF_GRID_TYPES = ["softoptic-cover-test", "softoptic-maddox-grid"]
const DETAILS_TYPE = "softoptic-details"
// Which softoptic-details slots each tab shows.
const TAB_DETAIL_SLOTS: Partial<Record<SoftopticExamTab, string[]>> = {
  anamnesa: ["anamnesa"],
  oldRef1: ["old-ref-1"],
  oldRef2: ["old-ref-2"],
  oldRef3: ["old-ref-3"],
  fundus: ["fundus"],
  bioMicroscopy: ["bio"],
  bino: ["bino"],
  subjective: ["subjective", "final"],
}

// Card types per tab, in OpticSoft's on-screen order.
const TAB_CARD_TYPES: Record<SoftopticExamTab, string[]> = {
  objective: ["keratometer-full", "keratometer", "retinoscop", "retinoscop-dilation", "objective", "corneal-topography", "uncorrected-va"],
  anamnesa: ["uncorrected-va", "anamnesis", DETAILS_TYPE],
  oldRef3: [...OLD_REFRACTION_TYPES, ...OLD_REF_GRID_TYPES, DETAILS_TYPE],
  oldRef2: [...OLD_REFRACTION_TYPES, ...OLD_REF_GRID_TYPES, DETAILS_TYPE],
  oldRef1: [...OLD_REFRACTION_TYPES, ...OLD_REF_GRID_TYPES, DETAILS_TYPE],
  summary: [...OLD_REFRACTION_TYPES, "final-subjective", "addition", "keratometer", "uncorrected-va"],
  amslerGrid: [],
  fundus: [DETAILS_TYPE],
  bioMicroscopy: ["schirmer-test", "contact-lens-diameters", DETAILS_TYPE],
  bino: [
    "softoptic-cover-test", "cover-test-v2", "cover-test", "maddox-wing", "stereo-test", "maddox-rod",
    "softoptic-ocular-mot", "ocular-motor-assessment", "npc", "softoptic-rg", "rg", "fusion-range", DETAILS_TYPE,
  ],
  subjective: ["subjective", "final-subjective", "addition", "rg-balance", "uncorrected-va", DETAILS_TYPE],
}

/**
 * Sections OpticSoft always draws in a tab, even empty. Missing ones are added as empty cards keyed by
 * their type, so whatever is typed into them is stored like any other component.
 */
const TAB_PLACEHOLDER_TYPES: Partial<Record<SoftopticExamTab, string[]>> = {
  objective: ["retinoscop-dilation", "corneal-topography"],
}

const BINO_GRID_ID = "softoptic-cover-test-bino"
// The Bino cover test is also imported into the simpler cover-test-v2 card; the full grid replaces it.
const BINO_GRID_REPLACES = ["cover-test-v2"]

/** Which of the card's internal old-refraction tabs holds OpticSoft's "Old Ref n". */
export function oldRefTabId(tabIds: string[] | undefined, n: number): string | undefined {
  if (!tabIds?.length) return undefined
  // Imports name the tabs "1".."3" after old1..old3; older imports only kept their order.
  const numbered = tabIds.some((id) => ["1", "2", "3"].includes(id))
  return numbered ? tabIds.find((id) => id === String(n)) : tabIds[n - 1]
}

const gridSlot = (card: CardDef) => Number(/-(\d+)$/.exec(card.id)?.[1])

/**
 * Old Ref cover-test and Maddox data loads as one tabbed card ("<type>-1", tabs 1..3), but each OpticSoft
 * Old Ref tab shows its own slot, so the data view needs one card per stored tab.
 */
export function softopticGridSlotCardId(type: string, value: { card_id?: unknown; card_instance_id?: unknown } | null | undefined): string | null {
  if (!OLD_REF_GRID_TYPES.includes(type) || !value?.card_id) return null
  return /^[1-3]$/.test(String(value.card_instance_id)) ? `${value.card_id}-${value.card_instance_id}` : null
}

export type SoftopticTabView<T extends CardDef = CardDef> = {
  key: SoftopticTabKey
  cards: T[]
  oldRef?: number
  /** Types of the empty cards this tab adds; their component key is the type itself. */
  placeholders?: string[]
}

/** Add the order's prescription without replacing the exam's own clinical cards. */
export function withContactLensTab<T extends CardDef>(tabs: SoftopticTabView<T>[], hasOrders: boolean): SoftopticTabView<T>[] {
  return hasOrders ? [...tabs, { key: SOFTOPTIC_CONTACT_LENS_TAB, cards: [] }] : tabs
}

// A tab's card list names a single details slot as "softoptic-details:<slot>".
const detailsSpec = (slot: string) => `${DETAILS_TYPE}:${slot}`

const FIT_OLD_REF_TABS: Partial<Record<SoftopticFitTab, number>> = { rxCl1: 1, rxCl2: 2 }
const BINO_CARD_TYPES = TAB_CARD_TYPES.bino.filter((type) => type !== DETAILS_TYPE)

// Card types per fit tab, in OpticSoft's on-screen order.
const FIT_TAB_CARD_TYPES: Record<SoftopticFitTab, string[]> = {
  subjective: [
    "schirmer-test", detailsSpec("subjective"), "final-subjective", "addition", "keratometer", "uncorrected-va",
    detailsSpec("eye-test"),
  ],
  bioM: ["schirmer-test", "contact-lens-diameters", detailsSpec("bio"), detailsSpec("eye-test")],
  rxCl1: [...OLD_REFRACTION_TYPES, detailsSpec("old-ref-1"), ...OLD_REF_GRID_TYPES],
  rxCl2: [...OLD_REFRACTION_TYPES, detailsSpec("old-ref-2"), ...OLD_REF_GRID_TYPES],
  fitting: [detailsSpec("fitting"), "old-contact-lenses", "objective", "keratometer", "over-refraction"],
  observation: ["sensation-vision-stability", detailsSpec("observation")],
  bino: [...BINO_CARD_TYPES, detailsSpec("bino")],
}

// OpticSoft shows every fit tab with its sections, so empty ones are drawn for typing in.
const FIT_TAB_PLACEHOLDER_TYPES: Partial<Record<SoftopticFitTab, string[]>> = {
  subjective: ["schirmer-test", "final-subjective", "addition", "keratometer", "uncorrected-va"],
  bioM: ["schirmer-test", "contact-lens-diameters"],
  fitting: ["old-contact-lenses", "objective", "keratometer", "over-refraction"],
  observation: ["sensation-vision-stability"],
  bino: ["maddox-wing", "stereo-test", "maddox-rod", "fusion-range"],
}

type TabConfig<K extends string> = {
  tabs: readonly K[]
  cardTypes: Record<K, string[]>
  detailSlots: Partial<Record<K, string[]>>
  oldRefTabs: Partial<Record<K, number>>
  placeholderTypes: Partial<Record<K, string[]>>
  /** Show tabs that have no data, as OpticSoft does. */
  showEmpty?: boolean
}

function buildTabs<T extends CardDef, K extends SoftopticTabKey>(
  cards: T[],
  oldRefTabs: (card: T) => string[] | undefined,
  config: TabConfig<K>,
): SoftopticTabView<T>[] {
  const placed = new Set<T>()
  const tabs: SoftopticTabView<T>[] = []

  const binoGrid = cards.some((card) => card.type === "softoptic-cover-test" && card.id === BINO_GRID_ID)
  if (binoGrid) cards.filter((card) => BINO_GRID_REPLACES.includes(card.type)).forEach((card) => placed.add(card))

  for (const key of config.tabs) {
    const oldRef = config.oldRefTabs[key]
    const isBino = key === "bino"
    const placeholderTypes = config.placeholderTypes[key] ?? []
    const placeholders: string[] = []
    const tabCards = config.cardTypes[key].flatMap((spec) => {
      const [type, slot] = spec.split(":")
      const matches = cards.filter((card) => {
        if (card.type !== type) return false
        if (type === DETAILS_TYPE) return slot ? card.id === slot : Boolean(config.detailSlots[key]?.includes(card.id))
        if (isBino && binoGrid && BINO_GRID_REPLACES.includes(type)) return false
        if (isBino && OLD_REF_GRID_TYPES.includes(type)) return card.id === BINO_GRID_ID
        if (oldRef == null) return true
        if (OLD_REF_GRID_TYPES.includes(type)) return gridSlot(card) === oldRef
        return Boolean(oldRefTabId(oldRefTabs(card), oldRef))
      })
      matches.forEach((card) => placed.add(card))
      if (matches.length || !placeholderTypes.includes(type)) return matches
      placeholders.push(type)
      return [{ id: type, type } as T]
    })
    // Otherwise a tab only appears for real data; placeholders just complete a tab that is already shown.
    if (config.showEmpty || tabCards.length > placeholders.length) {
      tabs.push({ key, cards: tabCards, ...(oldRef ? { oldRef } : {}), ...(placeholders.length ? { placeholders } : {}) })
    }
  }

  const rest = cards.filter((card) => !placed.has(card))
  if (rest.length) tabs.push({ key: SOFTOPTIC_MORE_TAB, cards: rest })
  return tabs
}

/**
 * The OpticSoft tabs that have data for this exam, each with its cards in display order.
 * `oldRefTabs` returns an old-refraction card's internal tab ids.
 */
export function buildSoftopticTabs<T extends CardDef>(cards: T[], oldRefTabs: (card: T) => string[] | undefined): SoftopticTabView<T>[] {
  return buildTabs(cards, oldRefTabs, {
    tabs: SOFTOPTIC_EXAM_TABS,
    cardTypes: TAB_CARD_TYPES,
    detailSlots: TAB_DETAIL_SLOTS,
    oldRefTabs: OLD_REF_TABS,
    placeholderTypes: TAB_PLACEHOLDER_TYPES,
  })
}

/**
 * A contact lens fit on OpticSoft's fit screen: all seven tabs, each with its sections.
 * Rx+Cl 1 and 2 show the fit's first and second old refraction.
 */
export function buildSoftopticFitTabs<T extends CardDef>(cards: T[], oldRefTabs: (card: T) => string[] | undefined): SoftopticTabView<T>[] {
  return buildTabs(cards, oldRefTabs, {
    tabs: SOFTOPTIC_FIT_TABS,
    cardTypes: FIT_TAB_CARD_TYPES,
    detailSlots: {},
    oldRefTabs: FIT_OLD_REF_TABS,
    placeholderTypes: FIT_TAB_PLACEHOLDER_TYPES,
    showEmpty: true,
  })
}

/** OpticSoft opens an exam on its summary, and a contact lens fit on its fitting. */
export function defaultSoftopticTab(tabs: SoftopticTabView[]): SoftopticTabKey | null {
  return (tabs.find((tab) => tab.key === "summary" || tab.key === "fitting") ?? tabs[0])?.key ?? null
}
