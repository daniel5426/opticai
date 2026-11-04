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
/** Cards no OpticSoft tab covers get their own trailing tab, so imported data is never hidden. */
export const SOFTOPTIC_MORE_TAB = "more"
export type SoftopticTabKey = SoftopticExamTab | typeof SOFTOPTIC_MORE_TAB

const OLD_REF_TABS: Partial<Record<SoftopticExamTab, number>> = { oldRef1: 1, oldRef2: 2, oldRef3: 3 }
const OLD_REFRACTION_TYPES = ["old-refraction-extension", "old-refraction"]
const OLD_REF_GRID_TYPES = ["softoptic-cover-test", "softoptic-maddox-grid"]

// Card types per tab, in OpticSoft's on-screen order.
const TAB_CARD_TYPES: Record<SoftopticExamTab, string[]> = {
  objective: ["keratometer-full", "keratometer", "retinoscop", "retinoscop-dilation", "objective", "corneal-topography", "uncorrected-va"],
  anamnesa: ["uncorrected-va", "anamnesis"],
  oldRef3: [...OLD_REFRACTION_TYPES, ...OLD_REF_GRID_TYPES],
  oldRef2: [...OLD_REFRACTION_TYPES, ...OLD_REF_GRID_TYPES],
  oldRef1: [...OLD_REFRACTION_TYPES, ...OLD_REF_GRID_TYPES],
  summary: [...OLD_REFRACTION_TYPES, "final-subjective", "addition", "keratometer", "uncorrected-va"],
  amslerGrid: [],
  fundus: [],
  bioMicroscopy: ["schirmer-test", "contact-lens-diameters"],
  bino: [
    "softoptic-cover-test", "cover-test-v2", "cover-test", "maddox-wing", "stereo-test", "maddox-rod",
    "softoptic-ocular-mot", "ocular-motor-assessment", "npc", "softoptic-rg", "rg", "fusion-range",
  ],
  subjective: ["subjective", "final-subjective", "addition", "rg-balance", "uncorrected-va"],
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

export type SoftopticTabView<T extends CardDef = CardDef> = {
  key: SoftopticTabKey
  cards: T[]
  oldRef?: number
  /** Types of the empty cards this tab adds; their component key is the type itself. */
  placeholders?: string[]
}

/**
 * The OpticSoft tabs that have data for this exam, each with its cards in display order.
 * `oldRefTabs` returns an old-refraction card's internal tab ids.
 */
export function buildSoftopticTabs<T extends CardDef>(cards: T[], oldRefTabs: (card: T) => string[] | undefined): SoftopticTabView<T>[] {
  const placed = new Set<T>()
  const tabs: SoftopticTabView<T>[] = []

  const binoGrid = cards.some((card) => card.type === "softoptic-cover-test" && card.id === BINO_GRID_ID)
  if (binoGrid) cards.filter((card) => BINO_GRID_REPLACES.includes(card.type)).forEach((card) => placed.add(card))

  for (const key of SOFTOPTIC_EXAM_TABS) {
    const oldRef = OLD_REF_TABS[key]
    const placeholderTypes = TAB_PLACEHOLDER_TYPES[key] ?? []
    const placeholders: string[] = []
    const tabCards = TAB_CARD_TYPES[key].flatMap((type) => {
      const matches = cards.filter((card) => {
        if (card.type !== type) return false
        if (key === "bino" && binoGrid && BINO_GRID_REPLACES.includes(type)) return false
        if (key === "bino" && OLD_REF_GRID_TYPES.includes(type)) return card.id === BINO_GRID_ID
        if (oldRef == null) return true
        if (OLD_REF_GRID_TYPES.includes(type)) return gridSlot(card) === oldRef
        return Boolean(oldRefTabId(oldRefTabs(card), oldRef))
      })
      matches.forEach((card) => placed.add(card))
      if (matches.length || !placeholderTypes.includes(type)) return matches
      placeholders.push(type)
      return [{ id: type, type } as T]
    })
    // A tab only appears for real data; placeholders just complete a tab that is already shown.
    if (tabCards.length > placeholders.length) {
      tabs.push({ key, cards: tabCards, ...(oldRef ? { oldRef } : {}), ...(placeholders.length ? { placeholders } : {}) })
    }
  }

  const rest = cards.filter((card) => !placed.has(card))
  if (rest.length) tabs.push({ key: SOFTOPTIC_MORE_TAB, cards: rest })
  return tabs
}

/** OpticSoft opens an exam on its summary. */
export function defaultSoftopticTab(tabs: SoftopticTabView[]): SoftopticTabKey | null {
  return (tabs.find((tab) => tab.key === "summary") ?? tabs[0])?.key ?? null
}
