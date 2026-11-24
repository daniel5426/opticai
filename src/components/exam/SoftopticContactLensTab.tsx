import React from "react";
import { useTranslation } from "react-i18next";
import { ContactLensDetailsTab } from "@/components/exam/ContactLensDetailsTab";
import { ContactLensDiametersTab } from "@/components/exam/ContactLensDiametersTab";
import { ContactLensExamTab } from "@/components/exam/ContactLensExamTab";
import { KeratometerContactLensTab } from "@/components/exam/KeratometerContactLensTab";
import { SchirmerTestTab } from "@/components/exam/SchirmerTestTab";
import { ExamGridLayout } from "@/components/exam/ExamGridLayout";
import { Card, CardContent } from "@/components/ui/card";
import type { ContactLensOrderEntity } from "@/lib/db/schema-interface";
import { softopticContactLensExam } from "@/lib/softoptic-contact-lens";
import { packSoftopticCards } from "@/lib/softoptic-exam-layout";
import { isDefaultSoftopticSchirmer } from "@/lib/softoptic-exam-tabs";
import { isNonEmptyComponent } from "@/pages/exam-detail/utils";

const noop = () => {};
const orderCards = [
  "contact-lens-diameters", "schirmer-test", "keratometer-contact-lens", "contact-lens-details", "contact-lens-exam",
] as const;

export function SoftopticContactLensTab({ orders }: { orders: ContactLensOrderEntity[] }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 p-4">
      {orders.map((order) => {
        const data = (order.order_data || {}) as Record<string, any>;
        const details = [
          [t("softoptic.contactLens.remarks"), order.supplier_notes],
          [t("softoptic.contactLens.notes"), order.notes],
        ].filter(([, value]) => value);
        const cards = orderCards.filter(type => isNonEmptyComponent(type, data[type])
          && !isDefaultSoftopticSchirmer(type, data[type])).map(type => ({ id: type, type }));
        return (
          <div key={order.id} className="space-y-3">
            {details.length > 0 && (
              <Card className="examcard py-3">
                <CardContent className="space-y-1 px-4 text-sm">
                  {details.map(([label, value]) => (
                    <p key={label}><span className="text-muted-foreground">{label}: </span>{value}</p>
                  ))}
                </CardContent>
              </Card>
            )}
            <ExamGridLayout items={packSoftopticCards(cards)} renderItem={({ type }) => {
              switch (type) {
                case "contact-lens-diameters":
                  return <ContactLensDiametersTab contactLensDiametersData={data[type]} onContactLensDiametersChange={noop} isEditing={false} />;
                case "schirmer-test":
                  return <SchirmerTestTab schirmerTestData={data[type]} onSchirmerTestChange={noop} isEditing={false} />;
                case "keratometer-contact-lens":
                  return <div className="relative"><KeratometerContactLensTab keratometerContactLensData={data[type]} onKeratometerContactLensChange={noop} isEditing={false} /></div>;
                case "contact-lens-details":
                  return <ContactLensDetailsTab contactLensDetailsData={data[type]} onContactLensDetailsChange={noop} isEditing={false} />;
                case "contact-lens-exam":
                  return <ContactLensExamTab contactLensExamData={softopticContactLensExam(data[type])} onContactLensExamChange={noop} isEditing={false} />;
              }
            }} />
          </div>
        );
      })}
    </div>
  );
}
