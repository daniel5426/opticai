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
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  ScanSearch,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import {
  AnalyticsChartTooltip,
  AnalyticsMetricCard,
  AnalyticsPanel,
  AnalyticsRangePicker,
  AnalyticsTooltip,
  RankedMetricTable,
} from "@/components/analytics";
import { ListPageHeader } from "@/components/list-page-header";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/contexts/UserContext";
import { useAnalyticsRange } from "@/hooks/useAnalyticsRange";
import { apiClient } from "@/lib/api-client";
import type { InventoryAnalyticsResponse, InventoryInsightItem } from "@/lib/analytics";
import {
  CatalogVariant,
  DiscoveryCandidate,
  InventoryCategory,
  InventoryMovement,
  inventoryCategoryLabel,
  inventoryVariantDescription,
} from "@/lib/inventory";
import { ROLE_LEVELS, isRoleAtLeast } from "@/lib/role-levels";

type InventoryTab = "stock" | "activity" | "insights";
type InventoryVisibility = "active" | "archived" | "all";

const INVENTORY_HEADER_TABS = [
  { value: "stock", label: "מלאי וקטלוג" },
  { value: "activity", label: "תנועות" },
  { value: "insights", label: "תובנות אספקה" },
] as const;

const INVENTORY_PAGE_SIZE = 25;

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
};

const currencyFormatter = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});
const integerFormatter = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const FULFILLMENT_MIX_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
];

const dateFormatter = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "short",
  timeStyle: "short",
});

const movementLabels: Record<string, string> = {
  adjustment: "התאמה",
  import: "ייבוא",
  physical_count: "ספירה",
  reserve: "שריון להזמנה",
  reservation_change: "שינוי שריון",
  release: "שחרור שריון",
  consume: "מסירה ללקוח",
};

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

function InventorySummaryStrip({
  summary,
  canViewCost,
}: {
  summary: Record<string, number>;
  canViewCost: boolean;
}) {
  const items = [
    {
      key: "available",
      label: "זמין למכירה",
      value: summary.available || 0,
    },
    {
      key: "reserved",
      label: "משוריין להזמנות",
      value: summary.reserved || 0,
    },
    {
      key: "low-stock",
      label: "מלאי נמוך",
      value: summary.low_stock || 0,
    },
    {
      key: "out-of-stock",
      label: "אזל מהמלאי",
      value: summary.out_of_stock || 0,
    },
    {
      key: "variants",
      label: "וריאנטים פעילים",
      value: summary.variant_count || 0,
    },
    ...(canViewCost
      ? [
          {
            key: "value",
            label: "שווי מלאי בעלות",
            value: currencyFormatter.format(summary.stock_cost || 0),
          },
        ]
      : []),
  ];

  return (
    <section
      aria-label="סיכום מלאי"
      className={`grid w-full shrink-0 grid-cols-2 gap-3 md:grid-cols-3 ${
        canViewCost ? "xl:grid-cols-6" : "xl:grid-cols-5"
      }`}
    >
      {items.map((item) => (
        <div key={item.key} className="bg-card min-w-0 rounded-md border px-4 py-3.5">
          <p className="text-muted-foreground truncate text-sm">{item.label}</p>
          <p className="mt-1 truncate text-2xl font-semibold tracking-tight tabular-nums">{item.value}</p>
        </div>
      ))}
    </section>
  );
}

function CatalogDialog({
  open,
  onOpenChange,
  clinicId,
  editing,
  canViewCost,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: number;
  editing: CatalogVariant | null;
  canViewCost: boolean;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ ...emptyCatalogForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!editing) {
      setForm({ ...emptyCatalogForm });
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
    });
  }, [editing, open]);

  const setField = (field: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const save = async () => {
    if (!form.brand.trim() || !form.model.trim()) {
      toast.error("יש למלא מותג ודגם");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
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
          {field("brand", form.category === "frame" ? "מותג" : "יצרן")}
          {field("model", "דגם")}
          {field(
            "product_type",
            form.category === "frame" ? "סוג מסגרת" : "סוג עדשה",
          )}
          {field("material", "חומר")}
          {field("preferred_supplier", "ספק מועדף")}
          {form.category === "contact_lens"
            ? field("replacement_schedule", "תדירות החלפה")
            : null}
        </div>
        <div className="border-t pt-4">
          <p className="mb-3 text-sm font-medium">פרטי וריאנט מדויק</p>
          <div className="grid gap-4 md:grid-cols-3">
            {field("color", "צבע")}
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

function AdjustDialog({
  variant,
  clinicId,
  onOpenChange,
  onSaved,
}: {
  variant: CatalogVariant | null;
  clinicId: number;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [reorderPoint, setReorderPoint] = useState("");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!variant) return;
    setDelta("");
    setReason("");
    setReorderPoint(String(variant.balance?.reorder_point || 0));
    setTarget(String(variant.balance?.target_quantity || 0));
  }, [variant]);

  const save = async () => {
    if (!variant) return;
    if (!delta || Number(delta) === 0 || !reason.trim()) {
      toast.error("יש להזין שינוי כמות וסיבה");
      return;
    }
    setSaving(true);
    try {
      const adjusted = await apiClient.adjustInventoryBalance(variant.id, {
        clinic_id: clinicId,
        on_hand_delta: Number(delta),
        reason,
        expected_version: variant.balance?.id
          ? variant.balance.version
          : 1,
        idempotency_key: "manual-" + Date.now() + "-" + variant.id,
        reorder_point: Number(reorderPoint || 0),
        target_quantity: Number(target || 0),
      });
      if (adjusted.error) throw new Error(String(adjusted.error));
      toast.success("המלאי עודכן");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "עדכון המלאי נכשל");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(variant)} onOpenChange={onOpenChange}>
      <DialogContent className="text-right" dir="rtl">
        <DialogHeader>
          <DialogTitle>התאמת מלאי</DialogTitle>
          <DialogDescription>{variant?.display_name}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>שינוי כמות</Label>
            <Input
              type="number"
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
              dir="ltr"
            />
            <p className="text-muted-foreground text-xs">
              חיובי להוספה, שלילי להסרה
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>כמות זמינה כעת</Label>
            <div className="bg-muted/40 flex h-9 items-center rounded-md border px-3 tabular-nums">
              {variant?.balance?.available || 0}
            </div>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>סיבת ההתאמה</Label>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>נקודת הזמנה מחדש</Label>
            <Input
              type="number"
              min={0}
              value={reorderPoint}
              onChange={(event) => setReorderPoint(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>כמות יעד</Label>
            <Input
              type="number"
              min={0}
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={save} disabled={saving}>
            עדכן מלאי
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
      preview.rows,
      "desktop-" + Date.now(),
    );
    setCommitting(false);
    if (response.error) {
      toast.error(String(response.error));
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
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const { range: insightsRange, setRange: setInsightsRange } = useAnalyticsRange("90d");
  const [insights, setInsights] = useState<InventoryAnalyticsResponse | null>(null);
  const [insightsError, setInsightsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | InventoryCategory>("all");
  const [visibility, setVisibility] = useState<InventoryVisibility>("active");
  const [page, setPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogVariant | null>(null);
  const [adjusting, setAdjusting] = useState<CatalogVariant | null>(null);
  const [countOpen, setCountOpen] = useState(false);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedMovementReason, setSelectedMovementReason] = useState<
    string | null
  >(null);

  const canWrite = isRoleAtLeast(currentUser?.role_level, ROLE_LEVELS.worker);
  const canViewCost = isRoleAtLeast(
    currentUser?.role_level,
    ROLE_LEVELS.manager,
  );
  const clinicId = currentClinic?.id;
  const activeTabTitle =
    INVENTORY_HEADER_TABS.find((tab) => tab.value === activeTab)?.label ||
    "מלאי וקטלוג";
  const insightMetrics = useMemo(
    () => new Map((insights?.metrics || []).map((metric) => [metric.key, metric])),
    [insights?.metrics],
  );
  const rtlDemandSeries = useMemo(() => [...(insights?.demand_series || [])].reverse(), [insights?.demand_series]);
  const fulfillmentTotal = useMemo(
    () => (insights?.fulfillment_mix || []).reduce((total, item) => total + item.quantity, 0),
    [insights?.fulfillment_mix],
  );

  const load = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const [variantsResponse, summaryResponse, settingsResponse] =
      await Promise.all([
        apiClient.getInventoryVariants(clinicId, {
          includeArchived: visibility !== "active",
        }),
        apiClient.getInventorySummary(clinicId),
        apiClient.getInventorySettings(),
      ]);
    if (variantsResponse.data) setVariants(variantsResponse.data.items);
    if (summaryResponse.data) setSummary(summaryResponse.data);
    if (settingsResponse.data?.should_offer_discovery && canWrite)
      setDiscoveryOpen(true);
    if (activeTab === "activity") {
      const response = await apiClient.getInventoryMovements(clinicId);
      if (response.data) setMovements(response.data.items);
    }
    if (activeTab === "insights") {
      setInsightsError(false);
      const response = await apiClient.getInventoryInsights(clinicId, insightsRange);
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

  useEffect(() => {
    setPage(1);
  }, [category, search, visibility]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(filteredVariants.length / INVENTORY_PAGE_SIZE),
    );
    if (page > totalPages) setPage(totalPages);
  }, [filteredVariants.length, page]);

  const paginatedVariants = useMemo(
    () =>
      filteredVariants.slice(
        (page - 1) * INVENTORY_PAGE_SIZE,
        page * INVENTORY_PAGE_SIZE,
      ),
    [filteredVariants, page],
  );

  const paginatedMovements = useMemo(
    () =>
      movements.slice(
        (movementPage - 1) * INVENTORY_PAGE_SIZE,
        movementPage * INVENTORY_PAGE_SIZE,
      ),
    [movementPage, movements],
  );

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(movements.length / INVENTORY_PAGE_SIZE),
    );
    if (movementPage > totalPages) setMovementPage(totalPages);
  }, [movementPage, movements.length]);

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
        <ListPageHeader
          title={activeTabTitle}
          description={`קטלוג חברה משותף ומלאי מדויק עבור ${currentClinic?.name}`}
          className="mb-0 items-center"
          actions={
            activeTab === "insights" ? (
              <AnalyticsRangePicker value={insightsRange} onChange={setInsightsRange} disabled={loading} />
            ) : (
              <>
                {canWrite ? (
                  <Button onClick={() => { setEditing(null); setCatalogOpen(true); }}>
                    הוסף פריט
                    <Plus className="h-4 w-4" />
                  </Button>
                ) : null}
                <DropdownMenu dir="rtl">
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">פעולות <MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canWrite ? (
                      <>
                        <DropdownMenuItem onClick={() => setCountOpen(true)}>ספירת מלאי <ClipboardCheck className="h-4 w-4" /></DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setDiscoveryOpen(true)}>גילוי מהזמנות <ScanSearch className="h-4 w-4" /></DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setImportOpen(true)}>ייבוא CSV <Upload className="h-4 w-4" /></DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    ) : null}
                    <DropdownMenuItem onClick={() => void exportCsv()}>ייצוא CSV <ArrowDownToLine className="h-4 w-4" /></DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )
          }
        />

        {activeTab === "stock" ? (
          <InventorySummaryStrip
            summary={summary}
            canViewCost={canViewCost}
          />
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
            />
            <InventoryTable
              variants={paginatedVariants}
              total={filteredVariants.length}
              page={page}
              pageSize={INVENTORY_PAGE_SIZE}
              onPageChange={setPage}
              loading={loading}
              canWrite={canWrite}
              canViewCost={canViewCost}
              onAdjust={setAdjusting}
              onEdit={(variant) => {
                setEditing(variant);
                setCatalogOpen(true);
              }}
              onArchive={(variant) => void archive(variant)}
            />
          </TabsContent>

          <TabsContent
            value="activity"
            className="flex min-h-0 flex-1 flex-col gap-2.5"
          >
            <div className="bg-card min-h-0 flex-1 rounded-md">
              <Table
                dir="rtl"
                containerClassName="h-full min-h-0 overflow-auto overscroll-contain"
              >
                <TableHeader className="bg-card sticky top-0">
                  <TableRow>
                    <TableHead>תאריך</TableHead>
                    <TableHead>פריט</TableHead>
                    <TableHead>פעולה</TableHead>
                    <TableHead>במלאי</TableHead>
                    <TableHead>משוריין</TableHead>
                    <TableHead className="w-[28rem] max-w-[28rem]">
                      סיבה
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMovements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="whitespace-nowrap">
                        {dateFormatter.format(new Date(movement.created_at))}
                      </TableCell>
                      <TableCell>{movement.variant?.display_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {movementLabels[movement.movement_type] ||
                            movement.movement_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="tabular-nums" dir="ltr">
                        {movement.on_hand_delta > 0 ? "+" : ""}
                        {movement.on_hand_delta}
                      </TableCell>
                      <TableCell className="tabular-nums" dir="ltr">
                        {movement.reserved_delta > 0 ? "+" : ""}
                        {movement.reserved_delta}
                      </TableCell>
                      <TableCell className="w-[28rem] max-w-[28rem]">
                        {movement.reason ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedMovementReason(movement.reason)
                            }
                            className="hover:text-foreground focus-visible:ring-ring block w-full max-w-[28rem] truncate rounded-sm text-right text-sm outline-none hover:underline focus-visible:ring-2"
                            aria-label="הצג את סיבת התנועה המלאה"
                          >
                            {movement.reason}
                          </button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!movements.length && !loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-muted-foreground h-32 text-center"
                      >
                        עדיין אין תנועות מלאי.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
            <TablePagination
              page={movementPage}
              pageSize={INVENTORY_PAGE_SIZE}
              total={movements.length}
              onPageChange={setMovementPage}
              loading={loading}
            />
          </TabsContent>

          <TabsContent
            value="insights"
            className="min-h-0 space-y-4 overflow-y-auto"
          >
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <AnalyticsMetricCard metric={insightMetrics.get("consumed")} formatter={integerFormatter.format} loading={loading} error={insightsError} polarity="neutral" />
              <AnalyticsMetricCard metric={insightMetrics.get("inventory_fulfillment")} formatter={(value) => `${integerFormatter.format(value)}%`} loading={loading} error={insightsError} polarity="higher" />
              <AnalyticsMetricCard metric={insightMetrics.get("reorder")} formatter={integerFormatter.format} loading={loading} error={insightsError} polarity="lower" />
              <AnalyticsMetricCard metric={insightMetrics.get("out_of_stock")} formatter={integerFormatter.format} loading={loading} error={insightsError} polarity="lower" />
              <AnalyticsMetricCard metric={insightMetrics.get("slow_stock")} formatter={canViewCost ? currencyFormatter.format : integerFormatter.format} loading={loading} error={insightsError} polarity="lower" />
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.7fr)]">
              <AnalyticsPanel title="צריכה לאורך זמן" description="ביקוש מאומת לפי קטגוריה" loading={loading} error={insightsError} empty={!insights?.demand_series.length}>
                <div className="h-64" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rtlDemandSeries} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={10} fontSize={12} />
                      <YAxis orientation="right" axisLine={false} tickLine={false} allowDecimals={false} width={38} />
                      <AnalyticsChartTooltip content={<AnalyticsTooltip />} />
                      <Legend verticalAlign="bottom" height={28} wrapperStyle={{ direction: "rtl" }} />
                      <Bar dataKey="frame" stackId="demand" name="מסגרות" fill="hsl(var(--primary))" />
                      <Bar dataKey="contact_lens" stackId="demand" name="עדשות מגע" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </AnalyticsPanel>
              <AnalyticsPanel title="מקור אספקה" description="מלאי קיים לעומת הזמנת ספק" loading={loading} error={insightsError} empty={!insights?.fulfillment_mix.some((item) => item.quantity > 0)}>
                <div className="grid h-64 grid-cols-[minmax(0,1fr)_minmax(120px,0.8fr)] items-center gap-3" dir="rtl">
                  <div className="min-w-0 space-y-2">
                    {(insights?.fulfillment_mix || []).map((item, index) => (
                      <div key={item.source} className="flex min-w-0 items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: FULFILLMENT_MIX_COLORS[index % FULFILLMENT_MIX_COLORS.length] }} />
                          <span className="truncate" title={item.source}>{item.source}</span>
                        </span>
                        <span className="shrink-0 text-muted-foreground tabular-nums" dir="ltr">
                          {integerFormatter.format(item.quantity)} · {fulfillmentTotal ? Math.round((item.quantity / fulfillmentTotal) * 100) : 0}%
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
                          {(insights?.fulfillment_mix || []).map((item, index) => (
                            <Cell key={item.source} fill={FULFILLMENT_MIX_COLORS[index % FULFILLMENT_MIX_COLORS.length]} />
                          ))}
                        </Pie>
                        <AnalyticsChartTooltip content={<AnalyticsTooltip />} wrapperStyle={{ zIndex: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 z-0 flex flex-col items-center justify-center">
                      <strong className="text-xl leading-none tabular-nums">{integerFormatter.format(fulfillmentTotal)}</strong>
                      <span className="mt-1 text-[11px] text-muted-foreground">יחידות</span>
                    </div>
                  </div>
                </div>
              </AnalyticsPanel>
            </div>

            <AnalyticsPanel flat title="המלצות הזמנה מחדש" description="פריטים הדורשים פעולה לפי מלאי זמין וקצב צריכה" loading={loading} error={insightsError} empty={!insights?.reorder_suggestions.length}>
              <RankedMetricTable
                rows={insights?.reorder_suggestions || []}
                getKey={(item) => item.variant.id}
                columns={[
                  { key: "item", label: "פריטים להזמנה מחדש", render: (item) => <div><p className="font-medium">{item.variant.display_name}</p><p className="text-xs text-muted-foreground">{inventoryVariantDescription(item.variant)}</p></div> },
                  { key: "risk", label: "סיכון", render: (item) => <Badge variant={item.stockout_risk === "out_of_stock" || item.stockout_risk === "high" ? "destructive" : "outline"}>{riskLabels[item.stockout_risk]}</Badge> },
                  { key: "available", label: "זמין", render: (item) => integerFormatter.format(item.variant.balance.available), className: "tabular-nums" },
                  { key: "velocity", label: "קצב יומי", render: (item) => item.daily_velocity.toLocaleString("he-IL", { maximumFractionDigits: 2 }), className: "tabular-nums" },
                  { key: "cover", label: "ימי כיסוי", render: (item) => item.days_cover == null ? "—" : integerFormatter.format(item.days_cover), className: "tabular-nums" },
                  { key: "reorder", label: "כמות להזמנה", render: (item) => <strong>{integerFormatter.format(item.reorder_quantity)}</strong>, className: "tabular-nums" },
                  { key: "confidence", label: "ביטחון", render: (item) => confidenceLabels[item.confidence] },
                ]}
              />
            </AnalyticsPanel>

            <div className="grid items-start gap-4 xl:grid-cols-2">
              <AnalyticsPanel flat title="הפריטים הנצרכים ביותר" description="דירוג לפי יחידות ביקוש מאומתות" loading={loading} error={insightsError} empty={!insights?.top_consumed.length}>
                <RankedMetricTable
                  rows={insights?.top_consumed || []}
                  getKey={(item) => item.variant.id}
                  columns={[
                    { key: "item", label: "פריטים מובילים בצריכה", render: (item) => <span className="font-medium">{item.variant.display_name}</span> },
                    { key: "units", label: "יחידות", render: (item) => integerFormatter.format(item.units_demanded), className: "tabular-nums" },
                    { key: "cover", label: "ימי כיסוי", render: (item) => item.days_cover == null ? "—" : integerFormatter.format(item.days_cover), className: "tabular-nums" },
                  ]}
                />
              </AnalyticsPanel>
              <AnalyticsPanel flat title="מלאי ללא תנועה" description="פריטים במלאי שלא נרשמה עבורם צריכה בטווח" loading={loading} error={insightsError} empty={!insights?.slow_moving.length}>
                <RankedMetricTable
                  rows={insights?.slow_moving || []}
                  getKey={(item) => item.variant.id}
                  columns={[
                    { key: "item", label: "מלאי ללא תנועה", render: (item) => <span className="font-medium">{item.variant.display_name}</span> },
                    { key: "stock", label: "במלאי", render: (item) => integerFormatter.format(item.variant.balance.on_hand), className: "tabular-nums" },
                    { key: "value", label: canViewCost ? "שווי עלות" : "מצב", render: (item) => canViewCost ? currencyFormatter.format((item.variant.default_cost || 0) * item.variant.balance.on_hand) : "ללא תנועה", className: "tabular-nums" },
                  ]}
                />
              </AnalyticsPanel>
            </div>
            <p className="text-muted-foreground pb-2 text-xs">
              הנתונים מבוססים על הזמנות שאושרו ותנועות צריכה שלא משויכות לאותה הזמנה. רמת ביטחון: {insights?.data_quality.confidence === "high" ? "גבוהה" : insights?.data_quality.confidence === "medium" ? "בינונית" : "נמוכה"}.
              {insights?.data_quality.first_observation ? ` כיסוי נתונים החל מ-${new Date(insights.data_quality.first_observation).toLocaleDateString("he-IL")}.` : " עדיין אין היסטוריה מספקת."}
            </p>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog
        open={selectedMovementReason !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedMovementReason(null);
        }}
      >
        <DialogContent className="max-w-xl text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle>סיבת התנועה</DialogTitle>
            <DialogDescription>
              הטקסט המלא שנשמר עבור תנועת המלאי.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-muted/30 max-h-[55vh] overflow-y-auto rounded-md border p-4">
            <p className="whitespace-pre-wrap break-words text-sm leading-6">
              {selectedMovementReason}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedMovementReason(null)}
            >
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
        canViewCost={canViewCost}
        onSaved={() => void load()}
      />
      <AdjustDialog
        variant={adjusting}
        clinicId={clinicId}
        onOpenChange={(open) => !open && setAdjusting(null)}
        onSaved={() => void load()}
      />
      <CountDialog
        open={countOpen}
        onOpenChange={setCountOpen}
        variants={filteredVariants.filter(
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

function InventoryTable({
  variants,
  total,
  page,
  pageSize,
  onPageChange,
  loading,
  canWrite,
  canViewCost,
  onAdjust,
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
  onAdjust: (variant: CatalogVariant) => void;
  onEdit: (variant: CatalogVariant) => void;
  onArchive: (variant: CatalogVariant) => void;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="bg-card min-h-0 flex-1 rounded-md">
        <Table
          dir="rtl"
          containerClassName="h-full min-h-0 overflow-auto overscroll-contain"
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
                            className="rounded-sm text-right font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
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
                    <TableCell className="tabular-nums">
                      {canWrite &&
                      variant.is_stockable &&
                      !variant.archived_at ? (
                        <button
                          type="button"
                          onClick={() => onAdjust(variant)}
                          className="hover:bg-muted focus-visible:ring-ring -m-1 rounded-md px-2 py-1 tabular-nums transition-colors outline-none focus-visible:ring-2"
                          aria-label={`עדכון מלאי עבור ${variant.display_name}`}
                        >
                          {variant.balance?.on_hand || 0}
                        </button>
                      ) : (
                        variant.balance?.on_hand || 0
                      )}
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
                            disabled={
                              !variant.is_stockable || Boolean(variant.archived_at)
                            }
                            onClick={() => onAdjust(variant)}
                            aria-label={`התאם מלאי עבור ${variant.display_name}`}
                            title="התאם מלאי"
                          >
                            <SlidersHorizontal className="size-4" />
                          </Button>
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
            {!loading && !variants.length ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-muted-foreground h-40 text-center"
                >
                  אין פריטים התואמים לסינון. אפשר להוסיף פריט ראשון או לגלות
                  מוצרים מהזמנות.
                </TableCell>
              </TableRow>
            ) : null}
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
