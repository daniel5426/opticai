import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { ContactLensDetailsTab } from "@/components/exam/ContactLensDetailsTab";
import { ContactLensDiametersTab } from "@/components/exam/ContactLensDiametersTab";
import { ContactLensExamTab } from "@/components/exam/ContactLensExamTab";
import { KeratometerContactLensTab } from "@/components/exam/KeratometerContactLensTab";
import { SchirmerTestTab } from "@/components/exam/SchirmerTestTab";
import type { ContactLensOrderEntity } from "@/lib/db/schema-interface";
import { softopticContactLensExam } from "@/lib/softoptic-contact-lens";

const noop = () => {};

/**
 * OpticSoft's contact lens prescription screen for the exam's day. Older SoftOptic imports keep it only on
 * the contact lens order, so it is shown from there, read-only: the order stays where it is edited.
 */
export function SoftopticContactLensTab({ orders }: { orders: ContactLensOrderEntity[] }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 p-4">
      {orders.map((order) => {
        const data = (order.order_data || {}) as Record<string, any>;
        const details = [
          [t("softoptic.contactLens.type"), order.type],
          [t("softoptic.contactLens.remarks"), order.supplier_notes],
          [t("softoptic.contactLens.notes"), order.notes],
        ].filter(([, value]) => value);
        return (
          <div key={order.id} className="space-y-3">
            {details.length > 0 && (
              <Card className="examcard w-full py-3">
                <CardContent className="space-y-1 px-4 text-sm">
                  {details.map(([label, value]) => (
                    <p key={label}>
                      <span className="text-muted-foreground">{label}: </span>
                      {value}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}
            <div className="@container">
              <div className="grid grid-cols-1 gap-3 @[760px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)]">
                <ContactLensDiametersTab
                  contactLensDiametersData={data["contact-lens-diameters"] || {}}
                  onContactLensDiametersChange={noop}
                  isEditing={false}
                />
                <SchirmerTestTab schirmerTestData={data["schirmer-test"] || {}} onSchirmerTestChange={noop} isEditing={false} />
                {/* Its title is absolutely centred, so it needs its own positioned box. */}
                <div className="relative">
                  <KeratometerContactLensTab
                    keratometerContactLensData={data["keratometer-contact-lens"] || {}}
                    onKeratometerContactLensChange={noop}
                    isEditing={false}
                  />
                </div>
              </div>
            </div>
            <ContactLensDetailsTab
              contactLensDetailsData={data["contact-lens-details"] || {}}
              onContactLensDetailsChange={noop}
              isEditing={false}
            />
            <ContactLensExamTab
              contactLensExamData={softopticContactLensExam(data["contact-lens-exam"])}
              onContactLensExamChange={noop}
              isEditing={false}
            />
          </div>
        );
      })}
    </div>
  );
}
