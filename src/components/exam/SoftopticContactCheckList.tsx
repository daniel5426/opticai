import React from "react";
import { useTranslation } from "react-i18next";
import { useAppLocale } from "@/localization/use-app-locale";
import { ContactLensDetailsTab } from "./ContactLensDetailsTab";
import { ContactLensExamTab } from "./ContactLensExamTab";
import { ExamGridLayout } from "./ExamGridLayout";
import { OverRefractionTab } from "./OverRefractionTab";
import { packSoftopticCards } from "@/lib/softoptic-exam-layout";

const noop = () => {};
const cardTypes = ["over-refraction", "contact-lens-exam", "contact-lens-details"] as const;

export interface SoftopticContactEntry {
  order_id: number;
  checks: Array<{ id: number; date: string | null; data: Record<string, any> }>;
}

export function SoftopticContactCheckList({ checks }: { checks: SoftopticContactEntry["checks"] }) {
  const { t } = useTranslation();
  const { locale } = useAppLocale();
  if (!checks.length) return null;

  return <div className="space-y-4 p-4">
    {checks.map(({ id, date, data }) => {
      const cards = cardTypes.filter(type => data[type]).map(type => ({ id: type, type }));
      const displayedDate = date ? new Date(`${date}T12:00:00`).toLocaleDateString(locale) : "";
      return <section key={id}>
        <h3 className="mb-2 text-sm font-medium">
          {t("softoptic.visit.contactCheck")}{displayedDate && <> · <bdi>{displayedDate}</bdi></>}
        </h3>
        <ExamGridLayout items={packSoftopticCards(cards)} renderItem={({ type }) => {
          if (type === "over-refraction") return <OverRefractionTab data={data[type]} onChange={noop} isEditing={false} />;
          if (type === "contact-lens-exam") return <ContactLensExamTab contactLensExamData={data[type]} onContactLensExamChange={noop} isEditing={false} />;
          return <ContactLensDetailsTab contactLensDetailsData={data[type]} onContactLensDetailsChange={noop} isEditing={false} />;
        }} />
        {data.notes?.note && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{data.notes.note}</p>}
      </section>;
    })}
  </div>;
}
