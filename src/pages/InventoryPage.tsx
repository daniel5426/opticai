import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowDownToLine,
  ClipboardCheck,
  History,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  ScanSearch,
  Table2,
  Upload,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import {
  AnalyticsChartTooltip,
  AnalyticsMetricCard,
  AnalyticsPanel,
  AnalyticsTooltip,
  RankedMetricTable,
} from "@/components/analytics";
import {
  ContactLensCatalogCombobox,
  ContactLensCatalogField,
  ContactLensCatalogValues,
} from "@/components/inventory/ContactLensCatalogCombobox";
import {
  FrameCatalogCombobox,
  FrameCatalogField,
  FrameCatalogValues,
} from "@/components/inventory/FrameCatalogCombobox";
import { TableFiltersBar } from "@/components/table-filters-bar";
import { TablePagination } from "@/components/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUser } from "@/contexts/UserContext";
import { useAnalyticsRange } from "@/hooks/useAnalyticsRange";
import { apiClient } from "@/lib/api-client";
import type {
  InventoryAnalyticsResponse,
  InventoryInsightItem,
} from "@/lib/analytics";
import {
  CatalogVariant,
  DiscoveryCandidate,
  InventoryCategory,
  InventoryMovement,
  InventorySupplierGroup,
  filterInventoryVariantsBySupplier,
  groupInventoryVariantsBySupplier,
  inventoryCategoryLabel,
  inventoryVariantDescription,
} from "@/lib/inventory";
import { ROLE_LEVELS, isRoleAtLeast } from "@/lib/role-levels";

type InventoryTab = "stock" | "insights";
type InventoryVisibility = "active" | "archived" | "all";
type InventoryViewMode = "table" | "suppliers";
type InventorySupplierSelection = Pick<InventorySupplierGroup, "key" | "label">;

const INVENTORY_HEADER_TABS = [
  { value: "stock", label: "מלאי וקטלוג" },
  { value: "insights", label: "תובנות אספקה" },
] as const;

const INVENTORY_PAGE_SIZE = 25;
const SUPPLIER_CARD_PAGE_SIZE = 12;

const inventoryViewModeStorageKey = (userId: number) =>
  `inventory-view-mode:${userId}`;

const emptyCatalogForm = {
  category: "frame" as InventoryCategory,
  brand: "",
  model: "",
  product_type: "",
  material: "",
  preferred_supplier: "",
  replacement_schedule: "",
  color: "",
  eye_size: "",
  bridge: "",
  temple_length: "",
  height: "",
  sph: "",
  bc: "",
  dia: "",
  pack_size: "",
  cyl: "",
  axis: "",
  add: "",
  design: "",
  sku: "",
  barcode: "",
  default_cost: "",
  default_retail: "",
  reorder_point: "",
  target_quantity: "",
};

const currencyFormatter = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});
const integerFormatter = new Intl.NumberFormat("he-IL", {
  maximumFractionDigits: 0,
});
const FULFILLMENT_MIX_COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2))"];

const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "short",
  timeStyle: "short",
});

const riskLabels: Record<InventoryInsightItem["stockout_risk"], string> = {
  out_of_stock: "אזל",
  high: "סיכון גבוה",
  medium: "סיכון בינוני",
  low: "סיכון נמוך",
};

const confidenceLabels: Record<InventoryInsightItem["confidence"], string> = {
  high: "גבוה",
  medium: "בינוני",
  low: "נמוך",
};

function SummaryCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: React.ReactNode;
  detail?: string;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardContent className="px-5">
        <p className="text-muted-foreground text-xs">{title}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {detail ? (
          <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CatalogDialog({
  open,
  onOpenChange,
  clinicId,
  editing,
  initialSupplier,
  canViewCost,
  onSelectCatalogVariant,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: number;
  editing: CatalogVariant | null;
  initialSupplier?: string | null;
  canViewCost: boolean;
  onSelectCatalogVariant: (variant: CatalogVariant) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ ...emptyCatalogForm });
  const [saving, setSaving] = useState(false);
  const [catalogVariants, setCatalogVariants] = useState<CatalogVariant[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [dialogContent, setDialogContent] = useState<HTMLDivElement | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    if (!editing) {
      setForm({
        ...emptyCatalogForm,
        preferred_supplier: initialSupplier || "",
      });
      return;
    }
    const attributes = editing.attributes || {};
    setForm({
      ...emptyCatalogForm,
      category: editing.product.category,
      brand: editing.product.brand || "",
      model: editing.product.model || "",
      product_type: editing.product.product_type || "",
      material: editing.product.material || "",
      preferred_supplier: editing.product.preferred_supplier || "",
      replacement_schedule: editing.product.replacement_schedule || "",
      color: String(attributes.color || ""),
      eye_size: String(attributes.eye_size || ""),
      bridge: String(attributes.bridge || ""),
      temple_length: String(attributes.temple_length || ""),
      height: String(attributes.height || ""),
      sph: String(attributes.sph || ""),
      bc: String(attributes.bc || ""),
      dia: String(attributes.dia || ""),
      pack_size: String(attributes.pack_size || ""),
      cyl: String(attributes.cyl || ""),
      axis: String(attributes.axis || ""),
      add: String(attributes.add || ""),
      design: String(attributes.design || ""),
      sku: editing.sku || "",
      barcode: editing.barcode || "",
      default_cost:
        editing.default_cost == null ? "" : String(editing.default_cost),
      default_retail:
        editing.default_retail == null ? "" : String(editing.default_retail),
      reorder_point: String(editing.balance?.reorder_point ?? 0),
      target_quantity: String(editing.balance?.target_quantity ?? 0),
    });
  }, [editing, initialSupplier, open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingCatalog(true);
    void apiClient
      .getInventoryVariants(clinicId, {
        category: form.category,
        stockableOnly: true,
      })
      .then((response) => {
        if (active) setCatalogVariants(response.data?.items || []);
      })
      .catch(() => {
        if (active) setCatalogVariants([]);
      })
      .finally(() => {
        if (active) setLoadingCatalog(false);
      });
    return () => {
      active = false;
    };
  }, [clinicId, form.category, open]);

  const setField = (field: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const save = async () => {
    if (!form.brand.trim() || !form.model.trim()) {
      toast.error("יש למלא מותג ודגם");
      return;
    }
    if (
      editing &&
      Number(form.target_quantity || 0) > 0 &&
      Number(form.target_quantity || 0) < Number(form.reorder_point || 0)
    ) {
      toast.error("כמות היעד לא יכולה להיות נמוכה מנקודת ההזמנה מחדש");
      return;
    }
    setSaving(true);
    const attributes =
      form.category === "frame"
        ? {
            color: form.color,
            eye_size: form.eye_size ? Number(form.eye_size) : undefined,
            bridge: form.bridge ? Number(form.bridge) : undefined,
            temple_length: form.temple_length
              ? Number(form.temple_length)
              : undefined,
            height: form.height ? Number(form.height) : undefined,
          }
        : {
            color: form.color,
            sph: form.sph,
            bc: form.bc,
            dia: form.dia,
            pack_size: form.pack_size ? Number(form.pack_size) : undefined,
            cyl: form.cyl,
            axis: form.axis ? Number(form.axis) : undefined,
            add: form.add,
            design: form.design,
          };
    const product = {
      brand: form.brand,
      model: form.model,
      product_type: form.product_type,
      material: form.material,
      preferred_supplier: form.preferred_supplier,
      replacement_schedule:
        form.category === "contact_lens"
          ? form.replacement_schedule
          : undefined,
    };
    const variant = {
      attributes,
      sku: form.sku,
      barcode: form.barcode,
      default_cost: canViewCost ? form.default_cost : undefined,
      default_retail: form.default_retail,
      is_stockable: true,
    };
    try {
      if (editing) {
        const response = await apiClient.updateCatalogEntry(editing.id, {
          product,
          variant,
        });
        if (response.error) throw new Error(String(response.error));
        const policyResponse = await apiClient.updateInventoryPolicy(
          editing.id,
          {
            clinic_id: clinicId,
            reorder_point: Number(form.reorder_point || 0),
            target_quantity: Number(form.target_quantity || 0),
            expected_version: editing.balance?.version ?? 1,
          },
        );
        if (policyResponse.error) throw new Error(String(policyResponse.error));
      } else {
        const response = await apiClient.createCatalogEntry({
          clinic_id: clinicId,
          category: form.category,
          product,
          variant,
        });
        if (response.error) throw new Error(String(response.error));
      }
      toast.success(editing ? "הפריט עודכן" : "הפריט נוסף לקטלוג");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "שמירת הפריט נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const field = (name: keyof typeof form, label: string, type = "text") => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        value={form[name]}
        onChange={(event) => setField(name, event.target.value)}
        dir={type === "number" ? "ltr" : "rtl"}
      />
    </div>
  );

  const frameValues: FrameCatalogValues = {
    supplier: form.preferred_supplier,
    manufacturer: form.brand,
    model: form.model,
    color: form.color,
    width: form.eye_size ? Number(form.eye_size) : undefined,
  };
  const contactLensValues: ContactLensCatalogValues = {
    type: form.product_type,
    manufacturer: form.brand,
    model: form.model,
    supplier: form.preferred_supplier,
    material: form.material,
    color: form.color,
    sph: form.sph,
    bc: form.bc,
    diam: form.dia,
    cyl: form.cyl,
    ax: form.axis,
    read_ad: form.add,
  };
  const frameCatalogField = (
    fieldName: FrameCatalogField,
    formField: keyof typeof form,
    label: string,
    lookupType: string,
    lookupLabel: string,
    placeholder: string,
  ) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <FrameCatalogCombobox
        field={fieldName}
        value={form[formField]}
        values={frameValues}
        variants={catalogVariants}
        loadingCatalog={loadingCatalog}
        lookupType={lookupType}
        lookupLabel={lookupLabel}
        placeholder={placeholder}
        portalContainer={dialogContent}
        onChange={(value) => setField(formField, value)}
        onSelectProduct={(variant) => onSelectCatalogVariant(variant)}
      />
    </div>
  );
  const contactLensCatalogField = (
    fieldName: ContactLensCatalogField,
    formField: keyof typeof form,
    label: string,
    lookupType: string,
    lookupLabel: string,
    placeholder: string,
  ) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <ContactLensCatalogCombobox
        field={fieldName}
        value={form[formField]}
        values={contactLensValues}
        variants={catalogVariants}
        loadingCatalog={loadingCatalog}
        lookupType={lookupType}
        lookupLabel={lookupLabel}
        placeholder={placeholder}
        inputClassName="h-9 text-sm"
        center={false}
        portalContainer={dialogContent}
        onChange={(value) => setField(formField, value)}
        onSelectProduct={(variant) => onSelectCatalogVariant(variant)}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={setDialogContent}
        className="max-h-[88vh] max-w-3xl overflow-y-auto text-right"
        dir="rtl"
      >
        <DialogHeader>
          <DialogTitle>
            {editing ? "עריכת פריט קטלוג" : "הוספת פריט לקטלוג"}
          </DialogTitle>
          <DialogDescription>
            מוצר הוא המשפחה המשותפת; וריאנט הוא התצורה המדויקת שנמצאת במלאי.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>קטגוריה</Label>
            <Select
              value={form.category}
              onValueChange={(value) => setField("category", value)}
              disabled={Boolean(editing)}
              dir="rtl"
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="frame">מסגרת</SelectItem>
                <SelectItem value="contact_lens">עדשות מגע</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.category === "frame" ? (
            <>
              {frameCatalogField(
                "manufacturer",
                "brand",
                "מותג",
                "manufacturer",
                "מותגים",
                "בחר או הקלד מותג...",
              )}
              {frameCatalogField(
                "model",
                "model",
                "דגם",
                "frameModel",
                "דגמי מסגרות",
                "בחר או הקלד דגם מסגרת...",
              )}
              {field("product_type", "סוג מסגרת")}
              {field("material", "חומר")}
              {frameCatalogField(
                "supplier",
                "preferred_supplier",
                "ספק מועדף",
                "supplier",
                "ספקים",
                "בחר או הקלד ספק...",
              )}
            </>
          ) : (
            <>
              {contactLensCatalogField(
                "manufacturer",
                "brand",
                "יצרן",
                "manufacturer",
                "יצרנים",
                "בחר או הקלד יצרן...",
              )}
              {contactLensCatalogField(
                "model",
                "model",
                "דגם",
                "contactLensModel",
                "דגמי עדשות מגע",
                "בחר או הקלד דגם עדשה...",
              )}
              {contactLensCatalogField(
                "type",
                "product_type",
                "סוג עדשה",
                "contactLensType",
                "סוגי עדשות",
                "בחר או הקלד סוג עדשה...",
              )}
              {contactLensCatalogField(
                "material",
                "material",
                "חומר",
                "contactEyeMaterial",
                "חומרים",
                "בחר או הקלד חומר...",
              )}
              {contactLensCatalogField(
                "supplier",
                "preferred_supplier",
                "ספק מועדף",
                "supplier",
                "ספקים",
                "בחר או הקלד ספק...",
              )}
              {field("replacement_schedule", "תדירות החלפה")}
            </>
          )}
        </div>
        <div className="border-t pt-4">
          <p className="mb-3 text-sm font-medium">פרטי וריאנט מדויק</p>
          <div className="grid gap-4 md:grid-cols-3">
            {form.category === "frame"
              ? frameCatalogField(
                  "color",
                  "color",
                  "צבע",
                  "color",
                  "צבעים",
                  "בחר או הקלד צבע...",
                )
              : contactLensCatalogField(
                  "color",
                  "color",
                  "צבע",
                  "color",
                  "צבעים",
                  "בחר או הקלד צבע...",
                )}
            {form.category === "frame" ? (
              <>
                {field("eye_size", "גודל עין", "number")}
                {field("bridge", "גשר", "number")}
                {field("temple_length", "אורך זרוע", "number")}
                {field("height", "גובה", "number")}
              </>
            ) : (
              <>
                {field("sph", "SPH")}
                {field("bc", "BC")}
                {field("dia", "DIA")}
                {field("pack_size", "כמות באריזה", "number")}
                {field("cyl", "CYL")}
                {field("axis", "AXIS", "number")}
                {field("add", "ADD")}
                {field("design", "עיצוב מולטיפוקל")}
              </>
            )}
            {field("sku", "SKU")}
            {field("barcode", "ברקוד")}
            {canViewCost
              ? field("default_cost", "עלות ברירת מחדל", "number")
              : null}
            {field("default_retail", "מחיר מכירה מוצע", "number")}
          </div>
        </div>
        {editing ? (
          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium">מדיניות מלאי</p>
            <div className="grid gap-4 md:grid-cols-2">
              {field("reorder_point", "נקודת הזמנה מחדש", "number")}
              {field("target_quantity", "כמות יעד", "number")}
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={save} disabled={saving}>
            {editing ? "שמור שינויים" : "הוסף פריט"}
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CountDialog({
  open,
  onOpenChange,
  variants,
  clinicId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variants: CatalogVariant[];
  clinicId: number;
  onSaved: () => void;
}) {
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setCounts(
      Object.fromEntries(
        variants.map((variant) => [
          variant.id,
          String(variant.balance?.on_hand || 0),
        ]),
      ),
    );
  }, [open, variants]);
  const save = async () => {
    setSaving(true);
    const response = await apiClient.submitInventoryCount({
      clinic_id: clinicId,
      reason: "ספירת מלאי פיזית",
      idempotency_key: "count-" + Date.now(),
      items: variants.map((variant) => ({
        variant_id: variant.id,
        counted_quantity: Number(counts[variant.id] || 0),
      })),
    });
    setSaving(false);
    if (response.error) {
      toast.error(String(response.error));
      return;
    }
    toast.success("ספירת המלאי נשמרה");
    onOpenChange(false);
    onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] max-w-2xl overflow-y-auto text-right"
        dir="rtl"
      >
        <DialogHeader>
          <DialogTitle>ספירת מלאי פיזית</DialogTitle>
          <DialogDescription>
            הזן את הכמות שנמצאה בפועל. כל פער נשמר כתנועה מתועדת.
          </DialogDescription>
        </DialogHeader>
        <div className="divide-y rounded-md border">
          {variants.map((variant) => (
            <div
              key={variant.id}
              className="flex items-center justify-between gap-4 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {variant.display_name}
                </p>
                <p className="text-muted-foreground text-xs">
                  {inventoryVariantDescription(variant)}
                </p>
              </div>
              <Input
                className="w-24 text-center"
                type="number"
                min={variant.balance?.reserved || 0}
                value={counts[variant.id] || ""}
                onChange={(event) =>
                  setCounts((current) => ({
                    ...current,
                    [variant.id]: event.target.value,
                  }))
                }
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={save} disabled={saving || variants.length === 0}>
            שמור ספירה
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiscoveryDialog({
  open,
  onOpenChange,
  onFinished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinished: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [candidates, setCandidates] = useState<DiscoveryCandidate[]>([]);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);

  const scan = async () => {
    setLoading(true);
    const response = await apiClient.previewInventoryDiscovery();
    setLoading(false);
    if (response.error || !response.data) {
      toast.error(String(response.error || "הסריקה נכשלה"));
      return;
    }
    setCandidates(
      response.data.candidates.map((candidate) => ({
        ...candidate,
        selected: !candidate.needs_details,
      })),
    );
    setSummary(response.data.summary);
  };

  useEffect(() => {
    if (open && !summary && !loading) void scan();
    if (!open) {
      setCandidates([]);
      setSummary(null);
    }
  }, [open]);

  const updateCandidate = (
    index: number,
    update: Partial<DiscoveryCandidate>,
  ) =>
    setCandidates((current) =>
      current.map((candidate, currentIndex) =>
        currentIndex === index ? { ...candidate, ...update } : candidate,
      ),
    );

  const updateCandidateField = (
    index: number,
    group: "product" | "attributes",
    field: string,
    value: string,
  ) =>
    setCandidates((current) =>
      current.map((candidate, currentIndex) =>
        currentIndex === index
          ? { ...candidate, [group]: { ...candidate[group], [field]: value } }
          : candidate,
      ),
    );

  const confirm = async () => {
    setConfirming(true);
    const response = await apiClient.confirmInventoryDiscovery(candidates);
    setConfirming(false);
    if (response.error) {
      toast.error(
        typeof response.error === "string"
          ? response.error
          : "יש להשלים פרטים חסרים",
      );
      return;
    }
    await apiClient.acknowledgeInventoryDiscovery();
    toast.success("המוצרים שנבחרו נוספו לקטלוג עם מלאי אפס");
    onOpenChange(false);
    onFinished();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[88vh] max-w-4xl overflow-y-auto text-right"
        dir="rtl"
      >
        <DialogHeader>
          <DialogTitle>גילוי מוצרים מהזמנות קיימות</DialogTitle>
          <DialogDescription>
            הסריקה אינה משנה הזמנות. רק פריטים שתאשר יתווספו לקטלוג, עם כמות
            מלאי אפס.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex min-h-48 items-center justify-center">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            {summary ? (
              <div className="bg-muted/30 grid grid-cols-3 gap-3 rounded-md border p-3 text-center text-sm">
                <div>
                  <strong className="block text-lg">
                    {summary.orders_scanned || 0}
                  </strong>
                  הזמנות נסרקו
                </div>
                <div>
                  <strong className="block text-lg">
                    {summary.candidates || 0}
                  </strong>
                  פריטים נמצאו
                </div>
                <div>
                  <strong className="block text-lg">
                    {summary.needs_details || 0}
                  </strong>
                  דורשים השלמה
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              {candidates.map((candidate, index) => (
                <div
                  key={candidate.normalized_fingerprint}
                  className="rounded-md border p-3"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={Boolean(candidate.selected)}
                      onCheckedChange={(checked) =>
                        updateCandidate(index, { selected: Boolean(checked) })
                      }
                      aria-label="בחר מוצר"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {[candidate.product.brand, candidate.product.model]
                            .filter(Boolean)
                            .join(" ") || "מוצר ללא שם"}
                        </p>
                        <Badge variant="outline">
                          {inventoryCategoryLabel(candidate.category)}
                        </Badge>
                        <Badge
                          variant={
                            candidate.needs_details ? "secondary" : "outline"
                          }
                        >
                          {candidate.occurrence_count} הופעות
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {Object.entries(candidate.attributes)
                          .map(([key, value]) => key + ": " + value)
                          .join(" · ")}
                      </p>
                      {candidate.suggested_variant ? (
                        <p className="mt-2 text-xs text-amber-700">
                          דומה לפריט קיים:{" "}
                          {candidate.suggested_variant.display_name}. לא ימוזג
                          אוטומטית.
                        </p>
                      ) : null}
                      {candidate.needs_details ? (
                        <div className="mt-3 grid gap-2 rounded-md bg-amber-50/60 p-3 md:grid-cols-4">
                          <Input
                            placeholder={
                              candidate.category === "frame" ? "מותג" : "יצרן"
                            }
                            value={String(candidate.product.brand || "")}
                            onChange={(event) =>
                              updateCandidateField(
                                index,
                                "product",
                                "brand",
                                event.target.value,
                              )
                            }
                          />
                          <Input
                            placeholder="דגם"
                            value={String(candidate.product.model || "")}
                            onChange={(event) =>
                              updateCandidateField(
                                index,
                                "product",
                                "model",
                                event.target.value,
                              )
                            }
                          />
                          {candidate.category === "contact_lens" ? (
                            <>
                              <Input
                                placeholder="SPH"
                                value={String(candidate.attributes.sph || "")}
                                onChange={(event) =>
                                  updateCandidateField(
                                    index,
                                    "attributes",
                                    "sph",
                                    event.target.value,
                                  )
                                }
                              />
                              <Input
                                placeholder="BC"
                                value={String(candidate.attributes.bc || "")}
                                onChange={(event) =>
                                  updateCandidateField(
                                    index,
                                    "attributes",
                                    "bc",
                                    event.target.value,
                                  )
                                }
                              />
                              <Input
                                placeholder="DIA"
                                value={String(candidate.attributes.dia || "")}
                                onChange={(event) =>
                                  updateCandidateField(
                                    index,
                                    "attributes",
                                    "dia",
                                    event.target.value,
                                  )
                                }
                              />
                              <Input
                                placeholder="כמות באריזה"
                                value={String(
                                  candidate.attributes.pack_size || "",
                                )}
                                onChange={(event) =>
                                  updateCandidateField(
                                    index,
                                    "attributes",
                                    "pack_size",
                                    event.target.value,
                                  )
                                }
                              />
                            </>
                          ) : (
                            <>
                              <Input
                                placeholder="צבע"
                                value={String(candidate.attributes.color || "")}
                                onChange={(event) =>
                                  updateCandidateField(
                                    index,
                                    "attributes",
                                    "color",
                                    event.target.value,
                                  )
                                }
                              />
                              <Input
                                placeholder="גודל עין"
                                value={String(
                                  candidate.attributes.eye_size || "",
                                )}
                                onChange={(event) =>
                                  updateCandidateField(
                                    index,
                                    "attributes",
                                    "eye_size",
                                    event.target.value,
                                  )
                                }
                              />
                            </>
                          )}
                          <p className="text-muted-foreground col-span-full text-xs">
                            חסר: {candidate.missing_fields.join(", ")}. פריט לא
                            שלם יישאר לא זמין למלאי.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
              {!candidates.length ? (
                <div className="text-muted-foreground rounded-md border border-dashed p-10 text-center text-sm">
                  לא נמצאו מוצרים חדשים בהזמנות.
                </div>
              ) : null}
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            סגור
          </Button>
          <Button
            onClick={confirm}
            disabled={
              confirming || !candidates.some((candidate) => candidate.selected)
            }
          >
            צור פריטים שנבחרו
            {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  clinicId,
  onFinished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: number;
  onFinished: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const choose = async (file?: File) => {
    if (!file) return;
    setLoading(true);
    const response = await apiClient.previewInventoryImport(await file.text());
    setLoading(false);
    if (response.error) {
      toast.error(String(response.error));
      return;
    }
    setPreview(response.data);
  };
  const commit = async () => {
    if (!preview) return;
    setCommitting(true);
    const response = await apiClient.commitInventoryImport(
      clinicId,
      preview.rows.filter((row: any) => row.status === "valid"),
      "desktop-" + Date.now(),
    );
    setCommitting(false);
    if (response.error) {
      const detail = response.errorDetail as
        | {
            message?: string;
            rows?: { row_number?: number; errors?: string[] }[];
          }
        | undefined;
      const rowError = detail?.rows?.[0];
      toast.error(
        rowError
          ? `שורה ${rowError.row_number}: ${(rowError.errors || []).join(" · ")}`
          : detail?.message || String(response.error),
      );
      return;
    }
    if (response.data?.validation_errors?.length) {
      const first = response.data.validation_errors[0];
      toast.error(`שורה ${first.row_number}: ${first.errors.join(" · ")}`);
      return;
    }
    toast.success((response.data?.created || 0) + " פריטים יובאו");
    onOpenChange(false);
    onFinished();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl text-right" dir="rtl">
        <DialogHeader>
          <DialogTitle>ייבוא קטלוג ומלאי מ-CSV</DialogTitle>
          <DialogDescription>
            הקובץ נבדק תחילה. לא נכתב דבר עד לאישור הסיכום.
          </DialogDescription>
        </DialogHeader>
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void choose(event.target.files?.[0])}
        />
        {!preview ? (
          <button
            type="button"
            className="hover:bg-muted/30 flex min-h-52 flex-col items-center justify-center gap-3 rounded-md border border-dashed"
            onClick={() => inputRef.current?.click()}
          >
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Upload className="text-muted-foreground h-7 w-7" />
            )}
            <span className="text-sm font-medium">בחר קובץ CSV</span>
            <span className="text-muted-foreground text-xs">
              עמודות: category, brand, model, color, eye_size ועוד
            </span>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <SummaryCard title="שורות" value={preview.total} />
              <SummaryCard title="תקינות" value={preview.valid} />
              <SummaryCard title="דורשות תיקון" value={preview.invalid} />
            </div>
            <div className="max-h-72 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שורה</TableHead>
                    <TableHead>מוצר</TableHead>
                    <TableHead>מצב</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.slice(0, 50).map((row: any) => (
                    <TableRow key={row.row_number}>
                      <TableCell>{row.row_number}</TableCell>
                      <TableCell>
                        {[row.data?.product?.brand, row.data?.product?.model]
                          .filter(Boolean)
                          .join(" ")}
                      </TableCell>
                      <TableCell>
                        {row.status === "valid" ? (
                          <Badge variant="outline">תקין</Badge>
                        ) : (
                          <span className="text-xs text-red-600">
                            {row.errors.join(" · ")}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          {preview ? (
            <Button
              onClick={commit}
              disabled={committing || preview.valid === 0}
            >
              ייבא {preview.valid} שורות תקינות
              {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function InventoryPage() {
  const { currentClinic, currentUser } = useUser();
  const [activeTab, setActiveTab] = useState<InventoryTab>("stock");
  const [variants, setVariants] = useState<CatalogVariant[]>([]);
  const { range: insightsRange, setRange: setInsightsRange } =
    useAnalyticsRange("90d");
  const [insights, setInsights] = useState<InventoryAnalyticsResponse | null>(
    null,
  );
  const [insightsError, setInsightsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | InventoryCategory>("all");
  const [visibility, setVisibility] = useState<InventoryVisibility>("active");
  const [page, setPage] = useState(1);
  const [supplierPage, setSupplierPage] = useState(1);
  const [viewMode, setViewMode] = useState<InventoryViewMode>("table");
  const [viewModeUserId, setViewModeUserId] = useState<number | null>(null);
  const [selectedSupplier, setSelectedSupplier] =
    useState<InventorySupplierSelection | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogVariant | null>(null);
  const [initialCatalogSupplier, setInitialCatalogSupplier] = useState<
    string | null
  >(null);
  const [historyVariant, setHistoryVariant] = useState<CatalogVariant | null>(
    null,
  );
  const [historyMovements, setHistoryMovements] = useState<InventoryMovement[]>(
    [],
  );
  const [historyLoading, setHistoryLoading] = useState(false);
  const [countOpen, setCountOpen] = useState(false);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const canWrite = isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.worker);
  const canViewCost = isRoleAtLeast(
    currentUser?.role_level,
    ROLE_LEVELS.manager,
  );
  const clinicId = currentClinic?.id;
  const displayedViewMode: InventoryViewMode = selectedSupplier
    ? "table"
    : viewMode;
  const activeTabTitle =
    INVENTORY_HEADER_TABS.find((tab) => tab.value === activeTab)?.label ||
    "מלאי וקטלוג";
  const insightMetrics = useMemo(
    () =>
      new Map((insights?.metrics || []).map((metric) => [metric.key, metric])),
    [insights?.metrics],
  );
  const rtlDemandSeries = useMemo(
    () => [...(insights?.demand_series || [])].reverse(),
    [insights?.demand_series],
  );
  const fulfillmentTotal = useMemo(
    () =>
      (insights?.fulfillment_mix || []).reduce(
        (total, item) => total + item.quantity,
        0,
      ),
    [insights?.fulfillment_mix],
  );

  useEffect(() => {
    const userId = currentUser?.id;
    if (!userId) {
      setViewMode("table");
      setViewModeUserId(null);
      return;
    }
    try {
      const stored = window.localStorage.getItem(
        inventoryViewModeStorageKey(userId),
      );
      setViewMode(stored === "suppliers" ? "suppliers" : "table");
    } catch {
      setViewMode("table");
    }
    setViewModeUserId(userId);
  }, [currentUser?.id]);

  useEffect(() => {
    const userId = currentUser?.id;
    if (!userId || viewModeUserId !== userId) return;
    try {
      window.localStorage.setItem(
        inventoryViewModeStorageKey(userId),
        viewMode,
      );
    } catch {
      // Local view preference is optional and must not affect inventory access.
    }
  }, [currentUser?.id, viewMode, viewModeUserId]);

  useEffect(() => {
    setSelectedSupplier(null);
    setPage(1);
    setSupplierPage(1);
  }, [clinicId]);

  const load = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const [variantsResponse, settingsResponse] = await Promise.all([
      apiClient.getInventoryVariants(clinicId, {
        includeArchived: visibility !== "active",
      }),
      apiClient.getInventorySettings(),
    ]);
    if (variantsResponse.data) setVariants(variantsResponse.data.items);
    if (settingsResponse.data?.should_offer_discovery && canWrite)
      setDiscoveryOpen(true);
    if (activeTab === "insights") {
      setInsightsError(false);
      const response = await apiClient.getInventoryInsights(
        clinicId,
        insightsRange,
      );
      if (response.error || !response.data) {
        setInsights(null);
        setInsightsError(true);
      } else {
        setInsights(response.data);
      }
    }
    setLoading(false);
  }, [activeTab, canWrite, clinicId, insightsRange, visibility]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredVariants = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return variants.filter((variant) => {
      if (visibility === "active" && variant.archived_at) return false;
      if (visibility === "archived" && !variant.archived_at) return false;
      if (category !== "all" && variant.product.category !== category)
        return false;
      if (!query) return true;
      return [
        variant.display_name,
        variant.product.brand,
        variant.product.model,
        variant.product.material,
        variant.sku,
        variant.barcode,
        inventoryVariantDescription(variant),
      ].some((value) =>
        String(value || "")
          .toLocaleLowerCase()
          .includes(query),
      );
    });
  }, [category, search, variants, visibility]);

  const supplierGroups = useMemo(
    () => groupInventoryVariantsBySupplier(filteredVariants),
    [filteredVariants],
  );

  const tableFilteredVariants = useMemo(() => {
    return filterInventoryVariantsBySupplier(
      filteredVariants,
      selectedSupplier?.key,
    );
  }, [filteredVariants, selectedSupplier]);

  useEffect(() => {
    setPage(1);
    setSupplierPage(1);
  }, [category, search, visibility]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(tableFilteredVariants.length / INVENTORY_PAGE_SIZE),
    );
    if (page > totalPages) setPage(totalPages);
  }, [page, tableFilteredVariants.length]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(supplierGroups.length / SUPPLIER_CARD_PAGE_SIZE),
    );
    if (supplierPage > totalPages) setSupplierPage(totalPages);
  }, [supplierGroups.length, supplierPage]);

  const paginatedVariants = useMemo(
    () =>
      tableFilteredVariants.slice(
        (page - 1) * INVENTORY_PAGE_SIZE,
        page * INVENTORY_PAGE_SIZE,
      ),
    [page, tableFilteredVariants],
  );

  const exportCsv = async () => {
    if (!clinicId) return;
    const response = await apiClient.downloadInventoryCsv(clinicId, {
      category: category === "all" ? undefined : category,
      search: search.trim() || undefined,
    });
    if (response.error || !response.data) {
      toast.error(String(response.error || "הייצוא נכשל"));
      return;
    }
    const blob = new Blob([response.data], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download =
      "inventory-" + new Date().toISOString().slice(0, 10) + ".csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!clinicId) return;

    const handleQuickAction = (action: string | undefined) => {
      if (!action) return;
      setActiveTab("stock");
      if (action === "count" && canWrite) setCountOpen(true);
      if (action === "discovery" && canWrite) setDiscoveryOpen(true);
      if (action === "import" && canWrite) setImportOpen(true);
      if (action === "export") void exportCsv();
    };
    const handleInventoryQuickAction = (event: Event) => {
      handleQuickAction(
        (event as CustomEvent<{ action?: string }>).detail?.action,
      );
    };

    window.addEventListener("inventoryQuickAction", handleInventoryQuickAction);
    try {
      const action = sessionStorage.getItem("sidebar-inventory-quick-action");
      if (action) {
        sessionStorage.removeItem("sidebar-inventory-quick-action");
        handleQuickAction(action);
      }
    } catch (error) {
      console.error("Unable to read inventory quick action:", error);
    }
    return () =>
      window.removeEventListener(
        "inventoryQuickAction",
        handleInventoryQuickAction,
      );
  }, [canWrite, clinicId, exportCsv]);

  const archive = async (variant: CatalogVariant) => {
    const response = await apiClient.archiveCatalogVariant(
      variant.id,
      Boolean(variant.archived_at),
    );
    if (response.error) {
      toast.error(String(response.error));
      return;
    }
    toast.success(variant.archived_at ? "הפריט שוחזר" : "הפריט הועבר לארכיון");
    void load();
  };

  const selectSupplier = (supplier: InventorySupplierSelection) => {
    setSelectedSupplier(supplier);
    setPage(1);
  };

  const clearSelectedSupplier = () => {
    setSelectedSupplier(null);
    setViewMode("suppliers");
    setSupplierPage(1);
  };

  const changeViewMode = (nextMode: string) => {
    if (nextMode !== "table" && nextMode !== "suppliers") return;
    setSelectedSupplier(null);
    setViewMode(nextMode);
    setPage(1);
    setSupplierPage(1);
  };

  const openCatalogForSupplier = (supplier?: string | null) => {
    setEditing(null);
    setInitialCatalogSupplier(supplier || null);
    setCatalogOpen(true);
  };

  const openHistory = async (variant: CatalogVariant) => {
    setHistoryVariant(variant);
    setHistoryMovements([]);
    setHistoryLoading(true);
    try {
      const response = await apiClient.getInventoryMovements(
        clinicId,
        variant.id,
      );
      if (response.error) throw new Error(String(response.error));
      setHistoryMovements(
        (response.data?.items || []).filter(
          (movement) => movement.on_hand_delta !== 0,
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "טעינת היסטוריית המלאי נכשלה",
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  if (!clinicId) {
    return (
      <>
        <SiteHeader title="מלאי ואספקה" />
        <div className="text-muted-foreground p-6 text-center text-sm">
          יש לבחור מרפאה כדי לצפות במלאי.
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader
        title={activeTabTitle}
        tabs={{
          activeTab,
          onTabChange: (value) => setActiveTab(value as InventoryTab),
          items: INVENTORY_HEADER_TABS,
        }}
      />
      <main
        className="flex h-full min-h-0 flex-1 flex-col gap-5 overflow-hidden p-4 lg:p-6"
        dir="rtl"
      >
        {activeTab === "stock" ? (
          <section
            aria-label="פעולות מלאי"
            className="flex h-9 shrink-0 items-center justify-between gap-3"
          >
            <h2 className="text-muted-foreground text-xl font-semibold tracking-tight">
              ניהול מוצרים, ספקים ורמות מלאי
            </h2>
            <div className="flex items-center gap-2">
              {canWrite ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      onClick={() => openCatalogForSupplier()}
                      aria-label="הוסף פריט"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>הוסף פריט</TooltipContent>
                </Tooltip>
              ) : null}
              <DropdownMenu dir="rtl">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        aria-label="פעולות מלאי"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>פעולות מלאי</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end">
                  {canWrite ? (
                    <>
                      <DropdownMenuItem onClick={() => setCountOpen(true)}>
                        ספירת מלאי <ClipboardCheck className="h-4 w-4" />
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDiscoveryOpen(true)}>
                        גילוי מהזמנות <ScanSearch className="h-4 w-4" />
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setImportOpen(true)}>
                        ייבוא CSV <Upload className="h-4 w-4" />
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <DropdownMenuItem onClick={() => void exportCsv()}>
                    ייצוא CSV <ArrowDownToLine className="h-4 w-4" />
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </section>
        ) : null}

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as InventoryTab)}
          className="min-h-0 flex-1"
        >
          <TabsContent
            value="stock"
            className="flex min-h-0 flex-1 flex-col gap-2.5"
          >
            <TableFiltersBar
              compact
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="חיפוש לפי מותג, דגם, SKU או ברקוד..."
              navigation={
                <Tabs
                  value={visibility}
                  onValueChange={(value) =>
                    setVisibility(value as InventoryVisibility)
                  }
                  className="gap-0"
                >
                  <TabsList>
                    <TabsTrigger value="active">פעילים</TabsTrigger>
                    <TabsTrigger value="archived">ארכיון</TabsTrigger>
                    <TabsTrigger value="all">הכל</TabsTrigger>
                  </TabsList>
                </Tabs>
              }
              filters={[
                {
                  key: "category",
                  value: category,
                  onChange: (value) =>
                    setCategory(value as "all" | InventoryCategory),
                  placeholder: "כל הקטגוריות",
                  widthClassName: "w-44",
                  options: [
                    { value: "all", label: "כל הקטגוריות" },
                    { value: "frame", label: "מסגרות" },
                    { value: "contact_lens", label: "עדשות מגע" },
                  ],
                },
              ]}
              inlineControls={
                <div className="flex items-center gap-2">
                  <ToggleGroup
                    type="single"
                    value={displayedViewMode}
                    onValueChange={changeViewMode}
                    variant="outline"
                    aria-label="תצוגת מלאי"
                  >
                    <ToggleGroupItem
                      value="table"
                      aria-label="תצוגת טבלה"
                      title="תצוגת טבלה"
                    >
                      <Table2 aria-hidden="true" />
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="suppliers"
                      aria-label="תצוגת ספקים"
                      title="תצוגת ספקים"
                    >
                      <LayoutGrid aria-hidden="true" />
                    </ToggleGroupItem>
                  </ToggleGroup>
                  {selectedSupplier ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="group/supplier-filter h-9 max-w-52 gap-1.5 px-3"
                      onClick={clearSelectedSupplier}
                      aria-label={`נקה סינון ספק: ${selectedSupplier.label}`}
                      title="נקה סינון ספק וחזור לתצוגת ספקים"
                    >
                      <span className="truncate group-hover/supplier-filter:hidden group-focus-visible/supplier-filter:hidden">
                        {selectedSupplier.label}
                      </span>
                      <X
                        className="hidden group-hover/supplier-filter:block group-focus-visible/supplier-filter:block"
                        aria-hidden="true"
                      />
                      <span className="sr-only">נקה סינון ספק</span>
                    </Button>
                  ) : null}
                </div>
              }
            />
            {displayedViewMode === "table" ? (
              <InventoryTable
                variants={paginatedVariants}
                total={tableFilteredVariants.length}
                page={page}
                pageSize={INVENTORY_PAGE_SIZE}
                onPageChange={setPage}
                loading={loading}
                canWrite={canWrite}
                canViewCost={canViewCost}
                clinicId={clinicId}
                onStockChanged={() => void load()}
                onHistory={(variant) => void openHistory(variant)}
                onEdit={(variant) => {
                  setInitialCatalogSupplier(null);
                  setEditing(variant);
                  setCatalogOpen(true);
                }}
                onArchive={(variant) => void archive(variant)}
              />
            ) : (
              <SupplierCards
                groups={supplierGroups}
                page={supplierPage}
                pageSize={SUPPLIER_CARD_PAGE_SIZE}
                onPageChange={setSupplierPage}
                loading={loading}
                canWrite={canWrite}
                onSelect={selectSupplier}
                onCreate={openCatalogForSupplier}
              />
            )}
          </TabsContent>

          <TabsContent
            value="insights"
            className="min-h-0 space-y-4 overflow-y-auto"
          >
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <AnalyticsMetricCard
                metric={insightMetrics.get("consumed")}
                formatter={integerFormatter.format}
                loading={loading}
                error={insightsError}
                polarity="neutral"
              />
              <AnalyticsMetricCard
                metric={insightMetrics.get("inventory_fulfillment")}
                formatter={(value) => `${integerFormatter.format(value)}%`}
                loading={loading}
                error={insightsError}
                polarity="higher"
              />
              <AnalyticsMetricCard
                metric={insightMetrics.get("reorder")}
                formatter={integerFormatter.format}
                loading={loading}
                error={insightsError}
                polarity="lower"
              />
              <AnalyticsMetricCard
                metric={insightMetrics.get("out_of_stock")}
                formatter={integerFormatter.format}
                loading={loading}
                error={insightsError}
                polarity="lower"
              />
              <AnalyticsMetricCard
                metric={insightMetrics.get("slow_stock")}
                formatter={
                  canViewCost
                    ? currencyFormatter.format
                    : integerFormatter.format
                }
                loading={loading}
                error={insightsError}
                polarity="lower"
              />
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.7fr)]">
              <AnalyticsPanel
                title="צריכה לאורך זמן"
                description="ביקוש מאומת לפי קטגוריה"
                loading={loading}
                error={insightsError}
                empty={!insights?.demand_series.length}
              >
                <div className="h-64" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={rtlDemandSeries}
                      margin={{ top: 6, right: 4, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        vertical={false}
                        strokeDasharray="4 4"
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tickMargin={10}
                        fontSize={12}
                      />
                      <YAxis
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                        width={38}
                      />
                      <AnalyticsChartTooltip content={<AnalyticsTooltip />} />
                      <Legend
                        verticalAlign="bottom"
                        height={28}
                        wrapperStyle={{ direction: "rtl" }}
                      />
                      <Bar
                        dataKey="frame"
                        stackId="demand"
                        name="מסגרות"
                        fill="hsl(var(--primary))"
                      />
                      <Bar
                        dataKey="contact_lens"
                        stackId="demand"
                        name="עדשות מגע"
                        fill="hsl(var(--chart-2))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </AnalyticsPanel>
              <AnalyticsPanel
                title="מקור אספקה"
                description="מלאי קיים לעומת הזמנת ספק"
                loading={loading}
                error={insightsError}
                empty={
                  !insights?.fulfillment_mix.some((item) => item.quantity > 0)
                }
              >
                <div
                  className="grid h-64 grid-cols-[minmax(0,1fr)_minmax(120px,0.8fr)] items-center gap-3"
                  dir="rtl"
                >
                  <div className="min-w-0 space-y-2">
                    {(insights?.fulfillment_mix || []).map((item, index) => (
                      <div
                        key={item.source}
                        className="flex min-w-0 items-center justify-between gap-3 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                FULFILLMENT_MIX_COLORS[
                                  index % FULFILLMENT_MIX_COLORS.length
                                ],
                            }}
                          />
                          <span className="truncate" title={item.source}>
                            {item.source}
                          </span>
                        </span>
                        <span
                          className="text-muted-foreground shrink-0 tabular-nums"
                          dir="ltr"
                        >
                          {integerFormatter.format(item.quantity)} ·{" "}
                          {fulfillmentTotal
                            ? Math.round(
                                (item.quantity / fulfillmentTotal) * 100,
                              )
                            : 0}
                          %
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="relative h-48 min-w-0" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={insights?.fulfillment_mix || []}
                          dataKey="quantity"
                          nameKey="source"
                          cx="50%"
                          cy="50%"
                          innerRadius="57%"
                          outerRadius="82%"
                          paddingAngle={2}
                          stroke="hsl(var(--card))"
                          strokeWidth={2}
                          isAnimationActive={false}
                        >
                          {(insights?.fulfillment_mix || []).map(
                            (item, index) => (
                              <Cell
                                key={item.source}
                                fill={
                                  FULFILLMENT_MIX_COLORS[
                                    index % FULFILLMENT_MIX_COLORS.length
                                  ]
                                }
                              />
                            ),
                          )}
                        </Pie>
                        <AnalyticsChartTooltip
                          content={<AnalyticsTooltip />}
                          wrapperStyle={{ zIndex: 10 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
                      <strong className="text-xl leading-none tabular-nums">
                        {integerFormatter.format(fulfillmentTotal)}
                      </strong>
                      <span className="text-muted-foreground mt-1 text-[11px]">
                        יחידות
                      </span>
                    </div>
                  </div>
                </div>
              </AnalyticsPanel>
            </div>

            <AnalyticsPanel
              flat
              title="המלצות הזמנה מחדש"
              description="פריטים הדורשים פעולה לפי מלאי זמין וקצב צריכה"
              loading={loading}
              error={insightsError}
              empty={!insights?.reorder_suggestions.length}
            >
              <RankedMetricTable
                rows={insights?.reorder_suggestions || []}
                getKey={(item) => item.variant.id}
                columns={[
                  {
                    key: "item",
                    label: "פריטים להזמנה מחדש",
                    render: (item) => (
                      <div>
                        <p className="font-medium">
                          {item.variant.display_name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {inventoryVariantDescription(item.variant)}
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: "risk",
                    label: "סיכון",
                    render: (item) => (
                      <Badge
                        variant={
                          item.stockout_risk === "out_of_stock" ||
                          item.stockout_risk === "high"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {riskLabels[item.stockout_risk]}
                      </Badge>
                    ),
                  },
                  {
                    key: "available",
                    label: "זמין",
                    render: (item) =>
                      integerFormatter.format(item.variant.balance.available),
                    className: "tabular-nums",
                  },
                  {
                    key: "velocity",
                    label: "קצב יומי",
                    render: (item) =>
                      item.daily_velocity.toLocaleString("he-IL", {
                        maximumFractionDigits: 2,
                      }),
                    className: "tabular-nums",
                  },
                  {
                    key: "cover",
                    label: "ימי כיסוי",
                    render: (item) =>
                      item.days_cover == null
                        ? "—"
                        : integerFormatter.format(item.days_cover),
                    className: "tabular-nums",
                  },
                  {
                    key: "reorder",
                    label: "כמות להזמנה",
                    render: (item) => (
                      <strong>
                        {integerFormatter.format(item.reorder_quantity)}
                      </strong>
                    ),
                    className: "tabular-nums",
                  },
                  {
                    key: "confidence",
                    label: "ביטחון",
                    render: (item) => confidenceLabels[item.confidence],
                  },
                ]}
              />
            </AnalyticsPanel>

            <div className="grid items-start gap-4 xl:grid-cols-2">
              <AnalyticsPanel
                flat
                title="הפריטים הנצרכים ביותר"
                description="דירוג לפי יחידות ביקוש מאומתות"
                loading={loading}
                error={insightsError}
                empty={!insights?.top_consumed.length}
              >
                <RankedMetricTable
                  rows={insights?.top_consumed || []}
                  getKey={(item) => item.variant.id}
                  columns={[
                    {
                      key: "item",
                      label: "פריטים מובילים בצריכה",
                      render: (item) => (
                        <span className="font-medium">
                          {item.variant.display_name}
                        </span>
                      ),
                    },
                    {
                      key: "units",
                      label: "יחידות",
                      render: (item) =>
                        integerFormatter.format(item.units_demanded),
                      className: "tabular-nums",
                    },
                    {
                      key: "cover",
                      label: "ימי כיסוי",
                      render: (item) =>
                        item.days_cover == null
                          ? "—"
                          : integerFormatter.format(item.days_cover),
                      className: "tabular-nums",
                    },
                  ]}
                />
              </AnalyticsPanel>
              <AnalyticsPanel
                flat
                title="מלאי ללא תנועה"
                description="פריטים במלאי שלא נרשמה עבורם צריכה בטווח"
                loading={loading}
                error={insightsError}
                empty={!insights?.slow_moving.length}
              >
                <RankedMetricTable
                  rows={insights?.slow_moving || []}
                  getKey={(item) => item.variant.id}
                  columns={[
                    {
                      key: "item",
                      label: "מלאי ללא תנועה",
                      render: (item) => (
                        <span className="font-medium">
                          {item.variant.display_name}
                        </span>
                      ),
                    },
                    {
                      key: "stock",
                      label: "במלאי",
                      render: (item) =>
                        integerFormatter.format(item.variant.balance.on_hand),
                      className: "tabular-nums",
                    },
                    {
                      key: "value",
                      label: canViewCost ? "שווי עלות" : "מצב",
                      render: (item) =>
                        canViewCost
                          ? currencyFormatter.format(
                              (item.variant.default_cost || 0) *
                                item.variant.balance.on_hand,
                            )
                          : "ללא תנועה",
                      className: "tabular-nums",
                    },
                  ]}
                />
              </AnalyticsPanel>
            </div>
            <p className="text-muted-foreground pb-2 text-xs">
              הנתונים מבוססים על הזמנות שאושרו ותנועות צריכה שלא משויכות לאותה
              הזמנה. רמת ביטחון:{" "}
              {insights?.data_quality.confidence === "high"
                ? "גבוהה"
                : insights?.data_quality.confidence === "medium"
                  ? "בינונית"
                  : "נמוכה"}
              .
              {insights?.data_quality.first_observation
                ? ` כיסוי נתונים החל מ-${new Date(insights.data_quality.first_observation).toLocaleDateString("he-IL")}.`
                : " עדיין אין היסטוריה מספקת."}
            </p>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog
        open={Boolean(historyVariant)}
        onOpenChange={(open) => {
          if (!open) setHistoryVariant(null);
        }}
      >
        <DialogContent className="max-w-lg text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>היסטוריית מלאי</DialogTitle>
            <DialogDescription>
              {historyVariant?.display_name}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto rounded-md border">
            {historyLoading ? (
              <div className="flex h-28 items-center justify-center">
                <Loader2 className="text-muted-foreground size-5 animate-spin" />
              </div>
            ) : historyMovements.length ? (
              <div className="divide-y">
                {historyMovements.map((movement) => (
                  <div
                    key={movement.id}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <span className="text-muted-foreground text-sm">
                      {dateFormatter.format(new Date(movement.created_at))}
                    </span>
                    <span
                      className={`font-medium tabular-nums ${
                        movement.on_hand_delta > 0
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-destructive"
                      }`}
                      dir="ltr"
                    >
                      {movement.on_hand_delta > 0 ? "+" : ""}
                      {movement.on_hand_delta}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground px-4 py-10 text-center text-sm">
                אין עדיין הוספות או הפחתות מלאי.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryVariant(null)}>
              סגור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CatalogDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        clinicId={clinicId}
        editing={editing}
        initialSupplier={initialCatalogSupplier}
        canViewCost={canViewCost}
        onSelectCatalogVariant={(variant) => {
          setInitialCatalogSupplier(null);
          setEditing(variant);
        }}
        onSaved={() => void load()}
      />
      <CountDialog
        open={countOpen}
        onOpenChange={setCountOpen}
        variants={tableFilteredVariants.filter(
          (variant) => variant.is_stockable && !variant.archived_at,
        )}
        clinicId={clinicId}
        onSaved={() => void load()}
      />
      <DiscoveryDialog
        open={discoveryOpen}
        onOpenChange={(open) => {
          setDiscoveryOpen(open);
          if (!open) void apiClient.acknowledgeInventoryDiscovery();
        }}
        onFinished={() => void load()}
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        clinicId={clinicId}
        onFinished={() => void load()}
      />
    </>
  );
}

function SupplierCardStats({ supplier }: { supplier: InventorySupplierGroup }) {
  const frameCount = supplier.variants.filter(
    (variant) => variant.product.category === "frame",
  ).length;
  const contactLensCount = supplier.variants.length - frameCount;
  const available = supplier.variants.reduce(
    (total, variant) => total + (variant.balance?.available || 0),
    0,
  );
  const categories = [
    frameCount ? `מסגרות ${frameCount}` : null,
    contactLensCount ? `עדשות ${contactLensCount}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
      <span>{categories}</span>
      <span aria-label={`זמין למכירה: ${available}`}>
        זמין{" "}
        <span dir="ltr" className="tabular-nums">
          {integerFormatter.format(available)}
        </span>
      </span>
    </span>
  );
}

export function SupplierCards({
  groups,
  page,
  pageSize,
  onPageChange,
  loading,
  canWrite,
  onSelect,
  onCreate,
}: {
  groups: InventorySupplierGroup[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading: boolean;
  canWrite: boolean;
  onSelect: (supplier: InventorySupplierSelection) => void;
  onCreate: (supplier: string) => void;
}) {
  const paginatedGroups = groups.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div dir="rtl" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="bg-card min-h-28 rounded-md border p-3.5"
              >
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="mt-4 h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : paginatedGroups.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {paginatedGroups.map((supplier) => (
              <article
                key={supplier.key}
                className="bg-card hover:border-primary/45 flex min-h-28 rounded-md border p-3.5 transition-colors"
              >
                <button
                  type="button"
                  onClick={() =>
                    onSelect({ key: supplier.key, label: supplier.label })
                  }
                  className="focus-visible:ring-ring flex min-w-0 flex-1 flex-col justify-between rounded-sm text-start outline-none focus-visible:ring-2"
                  aria-label={`הצג פריטים של ${supplier.label}`}
                >
                  <span
                    className="truncate text-base font-semibold"
                    title={supplier.label}
                  >
                    {supplier.label}
                  </span>
                  <SupplierCardStats supplier={supplier} />
                </button>
                {canWrite && !supplier.isUnassigned ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-foreground -ms-1 -mt-1"
                        onClick={() => onCreate(supplier.label)}
                        aria-label={`הוסף פריט עבור ${supplier.label}`}
                      >
                        <Plus aria-hidden="true" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>הוסף פריט לספק</TooltipContent>
                  </Tooltip>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground flex min-h-52 items-center justify-center rounded-md border border-dashed px-6 text-center text-sm">
            אין ספקים התואמים לסינון הנוכחי.
          </div>
        )}
      </div>
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={groups.length}
        onPageChange={onPageChange}
        loading={loading}
      />
    </div>
  );
}

function StockAdjustmentDropdown({
  variant,
  clinicId,
  onSaved,
}: {
  variant: CatalogVariant;
  clinicId: number;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setMode("add");
      setQuantity("");
    }
  };

  const save = async () => {
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("יש להזין כמות שלמה הגדולה מאפס");
      return;
    }
    setSaving(true);
    try {
      const response = await apiClient.adjustInventoryBalance(variant.id, {
        clinic_id: clinicId,
        on_hand_delta: mode === "add" ? amount : -amount,
        reason: "עדכון מלאי ידני",
        expected_version: variant.balance?.version ?? 1,
        idempotency_key: `manual-${Date.now()}-${variant.id}`,
      });
      if (response.error) throw new Error(String(response.error));
      toast.success(mode === "add" ? "המלאי נוסף" : "המלאי הופחת");
      setOpen(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "עדכון המלאי נכשל");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DropdownMenu dir="rtl" open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="cursor-pointer"
          aria-label={`עדכון מלאי עבור ${variant.display_name}`}
          onClick={(event) => event.stopPropagation()}
        >
          <Badge variant="outline" className="hover:bg-accent/70 tabular-nums">
            {variant.balance?.on_hand || 0}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-80 p-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bg-muted/30 mb-3 rounded-md border px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">במלאי / משוריין</span>
            <span className="font-medium tabular-nums" dir="ltr">
              {variant.balance?.on_hand || 0} / {variant.balance?.reserved || 0}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 border-t pt-1">
            <span className="text-muted-foreground">זמין</span>
            <span className="font-medium tabular-nums">
              {variant.balance?.available || 0}
            </span>
          </div>
        </div>
        <div className="border-t pt-3">
          <div className="text-muted-foreground mb-2 text-xs font-medium">
            עדכון מלאי
          </div>
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(value) => {
              if (value === "add" || value === "remove") setMode(value);
            }}
            variant="outline"
            className="mb-3 grid grid-cols-2"
            aria-label="סוג עדכון מלאי"
          >
            <ToggleGroupItem value="add">הוספה</ToggleGroupItem>
            <ToggleGroupItem value="remove">הפחתה</ToggleGroupItem>
          </ToggleGroup>
          <div>
            <div className="text-muted-foreground mb-1 text-xs">כמות</div>
            <Input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="h-9"
              dir="ltr"
              onKeyDown={(event) => {
                if (event.key === "Enter") void save();
              }}
            />
          </div>
          <div className="mt-3 flex justify-start">
            <Button size="sm" onClick={() => void save()} disabled={saving}>
              {saving
                ? "שומר..."
                : mode === "add"
                  ? "הוסף למלאי"
                  : "הפחת מהמלאי"}
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InventoryTable({
  variants,
  total,
  page,
  pageSize,
  onPageChange,
  loading,
  canWrite,
  canViewCost,
  clinicId,
  onStockChanged,
  onHistory,
  onEdit,
  onArchive,
}: {
  variants: CatalogVariant[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading: boolean;
  canWrite: boolean;
  canViewCost: boolean;
  clinicId: number;
  onStockChanged: () => void;
  onHistory: (variant: CatalogVariant) => void;
  onEdit: (variant: CatalogVariant) => void;
  onArchive: (variant: CatalogVariant) => void;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="bg-card min-h-0 flex-1 rounded-md">
        <Table
          dir="rtl"
          containerClassName="h-full min-h-0 overflow-auto overscroll-contain"
          emptyState={
            !loading && !variants.length
              ? "אין פריטים התואמים לסינון. אפשר להוסיף פריט ראשון או לגלות מוצרים מהזמנות."
              : undefined
          }
          showTrailingRowBorder
        >
          <TableHeader className="bg-card sticky top-0 z-10">
            <TableRow>
              <TableHead>מוצר</TableHead>
              <TableHead>קטגוריה</TableHead>
              <TableHead>וריאנט</TableHead>
              <TableHead>SKU / ברקוד</TableHead>
              <TableHead>במלאי</TableHead>
              <TableHead>משוריין</TableHead>
              <TableHead>זמין</TableHead>
              <TableHead>מחיר מכירה</TableHead>
              {canViewCost ? <TableHead>עלות</TableHead> : null}
              <TableHead className="w-28">
                <span className="sr-only">פעולות</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={canViewCost ? 10 : 9}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : variants.map((variant) => (
                  <TableRow
                    key={variant.id}
                    className={variant.archived_at ? "opacity-60" : ""}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <button
                            type="button"
                            disabled={!canWrite}
                            onClick={() => onEdit(variant)}
                            className="focus-visible:ring-ring rounded-sm text-right font-medium outline-none hover:underline focus-visible:ring-2 disabled:pointer-events-none"
                          >
                            {[variant.product.brand, variant.product.model]
                              .filter(Boolean)
                              .join(" ")}
                          </button>
                        </div>
                        {!variant.is_stockable ? (
                          <Badge variant="secondary">דורש השלמה</Badge>
                        ) : null}
                        {variant.archived_at ? (
                          <Badge variant="outline">ארכיון</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {inventoryCategoryLabel(variant.product.category)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inventoryVariantDescription(variant) || ""}
                    </TableCell>
                    <TableCell>
                      <p className="font-mono text-xs" dir="ltr">
                        {variant.sku || ""}
                      </p>
                      <p
                        className="text-muted-foreground font-mono text-xs"
                        dir="ltr"
                      >
                        {variant.barcode || ""}
                      </p>
                    </TableCell>
                    <TableCell className="group/stock tabular-nums">
                      <div className="flex items-center gap-1">
                        {canWrite &&
                        variant.is_stockable &&
                        !variant.archived_at ? (
                          <StockAdjustmentDropdown
                            variant={variant}
                            clinicId={clinicId}
                            onSaved={onStockChanged}
                          />
                        ) : (
                          <span>{variant.balance?.on_hand || 0}</span>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground size-7 opacity-0 transition-opacity group-hover/stock:opacity-100 focus-visible:opacity-100"
                          onClick={() => onHistory(variant)}
                          aria-label={`היסטוריית מלאי עבור ${variant.display_name}`}
                          title="היסטוריית מלאי"
                        >
                          <History className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {variant.balance?.reserved || 0}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          (variant.balance?.available || 0) <= 0
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {variant.balance?.available || 0}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {variant.default_retail == null
                        ? ""
                        : currencyFormatter.format(variant.default_retail)}
                    </TableCell>
                    {canViewCost ? (
                      <TableCell>
                        {variant.default_cost == null
                          ? ""
                          : currencyFormatter.format(variant.default_cost)}
                      </TableCell>
                    ) : null}
                    <TableCell className="whitespace-nowrap">
                      {canWrite ? (
                        <div className="flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground size-8"
                            onClick={() => onEdit(variant)}
                            aria-label={`ערוך את ${variant.display_name}`}
                            title="ערוך פריט"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={`size-8 ${
                              variant.archived_at
                                ? "text-muted-foreground"
                                : "text-muted-foreground hover:text-destructive"
                            }`}
                            onClick={() => onArchive(variant)}
                            aria-label={`${
                              variant.archived_at
                                ? "שחזר מהארכיון"
                                : "העבר לארכיון"
                            } את ${variant.display_name}`}
                            title={
                              variant.archived_at
                                ? "שחזר מהארכיון"
                                : "העבר לארכיון"
                            }
                          >
                            {variant.archived_at ? (
                              <ArchiveRestore className="size-4" />
                            ) : (
                              <Archive className="size-4" />
                            )}
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        loading={loading}
      />
    </div>
  );
}
