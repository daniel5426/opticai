import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EXAM_FIELDS } from "@/components/exam/data/exam-field-definitions";
import { BASE_VALUES } from "@/components/exam/data/exam-constants";
import {
  FastInput,
  FastSelect,
} from "@/components/exam/shared/OptimizedInputs";
import { NVJSelect } from "@/components/exam/shared/NVJSelect";
import { ToggleTextNumberInput } from "@/components/exam/shared/ToggleTextNumberInput";
import { VASelect } from "@/components/exam/shared/VASelect";

const SPH_OPTIONS = [
  "Plano",
  "Balance",
  "Amblyopia",
  "Occluder",
  "Frosted / Matte",
];

const CONTACT_ADD_OPTIONS = ["Low", "Medium", "High"];

type ContactLensPreviewData = Record<string, string>;

const contactColumns = [
  { key: "bc", label: "BC" },
  { key: "oz", label: "OZ" },
  { key: "diam", label: "DIAM" },
  { key: "sph", label: "SPH" },
  { key: "cyl", label: "CYL" },
  { key: "ax", label: "AX" },
  { key: "add", label: "ADD" },
  { key: "va", label: "VA" },
  { key: "j", label: "J" },
];

function ContactLensExamPreview() {
  const [data, setData] = useState<ContactLensPreviewData>({
    r_bc: "8.4",
    r_oz: "8.0",
    r_diam: "14.2",
    r_sph: "-2.25",
    r_cyl: "-0.75",
    r_ax: "90",
    r_add: "Medium",
    r_va: "6/6+1",
    r_j: "J1",
    comb_va: "6/6",
    comb_j: "J1+",
    l_bc: "8.5",
    l_oz: "8.0",
    l_diam: "14.2",
    l_sph: "-2.00",
    l_cyl: "-0.50",
    l_ax: "85",
    l_add: "1.50",
    l_va: "6/7.5",
    l_j: "J2",
  });

  const update = (field: string, value: string) => {
    setData((current) => ({ ...current, [field]: value }));
  };

  const renderInput = (eye: "r" | "l" | "comb", key: string) => {
    const field = `${eye}_${key}`;
    const value = data[field] || "";

    if (key === "va") {
      return (
        <VASelect value={value} onChange={(next) => update(field, next)} />
      );
    }
    if (key === "j") {
      return (
        <NVJSelect value={value} onChange={(next) => update(field, next)} />
      );
    }
    if (eye === "comb") return <div className="h-8" />;
    if (key === "bc") {
      return (
        <ToggleTextNumberInput
          value={value}
          onChange={(next) => update(field, next)}
          textOptions={["Flat", "Steep"]}
          textDisplayAliases={EXAM_FIELDS.CONTACT_LENS_BC.displayAliases}
          numericProps={{
            ...EXAM_FIELDS.CONTACT_LENS_BC,
            className: "h-8 text-xs",
          }}
        />
      );
    }
    if (key === "sph") {
      return (
        <ToggleTextNumberInput
          value={value}
          onChange={(next) => update(field, next)}
          textOptions={SPH_OPTIONS}
          textValueAliases={{ Plano: "0" }}
          textDisplayAliases={EXAM_FIELDS.SPH.displayAliases}
          numericProps={{ ...EXAM_FIELDS.SPH, className: "h-8 text-xs" }}
        />
      );
    }
    if (key === "add") {
      return (
        <ToggleTextNumberInput
          value={value}
          onChange={(next) => update(field, next)}
          textOptions={CONTACT_ADD_OPTIONS}
          numericProps={{ ...EXAM_FIELDS.READ_AD, className: "h-8 text-xs" }}
        />
      );
    }

    const config =
      key === "oz"
        ? EXAM_FIELDS.CONTACT_LENS_OZ
        : key === "diam"
          ? EXAM_FIELDS.CONTACT_LENS_DIAM
          : key === "cyl"
            ? EXAM_FIELDS.CYL
            : EXAM_FIELDS.AXIS;

    return (
      <FastInput
        {...config}
        value={value}
        onChange={(next) => update(field, next)}
        className="h-8 text-xs"
      />
    );
  };

  return (
    <Card className="examcard w-full pt-3 pb-4" dir="ltr">
      <CardContent className="px-4">
        <h3 className="text-muted-foreground mb-3 text-center font-medium">
          מרשם עדשות מגע
        </h3>
        <div className="grid grid-cols-[20px_repeat(9,minmax(64px,1fr))] items-center gap-2 overflow-x-auto pb-1">
          <div />
          {contactColumns.map((column) => (
            <span
              key={column.key}
              className="text-muted-foreground text-center text-xs font-medium"
            >
              {column.label}
            </span>
          ))}
          {(["r", "comb", "l"] as const).map((eye) => (
            <div key={eye} className="contents">
              <span className="flex h-8 items-center justify-center text-sm font-medium">
                {eye === "comb" ? "C" : eye.toUpperCase()}
              </span>
              {contactColumns.map((column) => (
                <div key={`${eye}-${column.key}`}>
                  {renderInput(eye, column.key)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DemoField({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border bg-background rounded-lg border p-4">
      <div className="mb-3 min-h-12">
        <div className="font-medium">{label}</div>
        <p className="text-muted-foreground mt-1 text-xs leading-5">
          {description}
        </p>
      </div>
      <div dir="ltr">{children}</div>
    </div>
  );
}

export default function LocalUiTestsPage() {
  const [sph, setSph] = useState("Occluder");
  const [contactAdd, setContactAdd] = useState("Medium");
  const [va, setVa] = useState("6/9+2");
  const [j, setJ] = useState("J2-");
  const [base, setBase] = useState("180");

  return (
    <main
      className="mx-auto w-full max-w-7xl space-y-6 overflow-auto p-6 pb-24"
      dir="rtl"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">LOCAL DEV ONLY</Badge>
            <span className="text-muted-foreground text-xs">
              Migration UI playground
            </span>
          </div>
          <h1 className="text-2xl font-semibold">בדיקות UI לערכי מיגרציה</h1>
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm">
            סביבת ניסוי בלבד. השינויים כאן אינם נשמרים ואינם משנים את כרטיסי
            הבדיקה האמיתיים.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Contact Lens Exam — proposed columns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ContactLensExamPreview />
          <p className="text-muted-foreground mt-3 text-xs">
            VA and J are regular columns. BC2 is intentionally not included.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Proposed supported values</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DemoField
            label="SPH presets"
            description="Numeric power or a supported clinical preset. Use the arrow to switch modes."
          >
            <ToggleTextNumberInput
              value={sph}
              onChange={setSph}
              textOptions={SPH_OPTIONS}
              textValueAliases={{ Plano: "0" }}
              textDisplayAliases={EXAM_FIELDS.SPH.displayAliases}
              numericProps={{ ...EXAM_FIELDS.SPH, className: "h-9" }}
            />
          </DemoField>

          <DemoField
            label="Contact-lens ADD"
            description="Numeric ADD or the commercial Low, Medium, and High categories."
          >
            <ToggleTextNumberInput
              value={contactAdd}
              onChange={setContactAdd}
              textOptions={CONTACT_ADD_OPTIONS}
              numericProps={{ ...EXAM_FIELDS.READ_AD, className: "h-9" }}
            />
          </DemoField>

          <DemoField
            label="VA with modifier"
            description="Choose a normal VA value; use the ± control to cycle through line modifiers."
          >
            <VASelect value={va} onChange={setVa} className="h-9" />
          </DemoField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Imported-only behavior</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DemoField
            label="J: unsupported legacy value"
            description="The imported value stays visible until it is replaced with a supported J option."
          >
            <NVJSelect value={j} onChange={setJ} className="h-9" />
          </DemoField>

          <DemoField
            label="Base: unsupported legacy value"
            description="180 remains visible as imported, but only IN, OUT, UP, and DOWN can be selected."
          >
            <FastSelect
              value={base}
              onChange={setBase}
              options={BASE_VALUES}
              allowImportedValue
              triggerClassName="h-9 w-full"
              center
            />
          </DemoField>

        </CardContent>
      </Card>
    </main>
  );
}
