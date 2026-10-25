import React from "react";
import { useTranslation } from "react-i18next";
import { SearchClientDetails } from "@/lib/db/schema-interface";

export function ClientSearchDetails({ client }: { client: SearchClientDetails }) {
  const { t } = useTranslation();
  const birthDate = client.date_of_birth?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const address = [
    [client.address_street, client.address_number].filter(Boolean).join(" "),
    client.address_city,
    client.postal_code,
  ].filter(Boolean).join(", ");
  const groups = [
    [
      { key: "nationalId", value: client.national_id, ltr: true },
      { key: "dateOfBirth", value: birthDate ? `${birthDate[3]}/${birthDate[2]}/${birthDate[1]}` : client.date_of_birth, ltr: true },
      { key: "healthFund", value: client.health_fund },
    ],
    [
      { key: "mobile", value: client.phone_mobile, ltr: true },
      { key: "homePhone", value: client.phone_home, ltr: true },
      { key: "workPhone", value: client.phone_work, ltr: true },
      { key: "additionalPhone", value: client.additional_phone, ltr: true },
      { key: "email", value: client.email, ltr: true },
    ],
    [{ key: "address", value: address }],
  ].map((fields) => fields.filter(({ value }) => value?.trim()))
    .filter((fields) => fields.length > 0);

  if (!groups.length) return null;

  return (
    <div className="mt-1.5 space-y-1 text-xs">
      {groups.map((fields) => (
        <dl key={fields[0].key} className="flex flex-wrap gap-x-4 gap-y-1">
          {fields.map(({ key, value, ltr }) => (
            <div key={key} className="flex min-w-0 max-w-full items-baseline gap-x-1">
              <dt className="text-muted-foreground shrink-0">{t(`globalSearch.${key}`)}:</dt>
              <dd className="min-w-0 [overflow-wrap:anywhere]" dir={ltr ? "ltr" : "auto"} data-no-localize>{value}</dd>
            </div>
          ))}
        </dl>
      ))}
    </div>
  );
}
