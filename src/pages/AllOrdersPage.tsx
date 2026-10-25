import React from "react";
import { useTranslation } from "react-i18next";
import { OrderGroupList } from "@/components/order-groups/OrderGroupList";
import { TableListPageContent } from "@/components/table-list-layout";
import { SiteHeader } from "@/components/site-header";

export default function AllOrdersPage() {
  const { t } = useTranslation();
  return <><SiteHeader title={t('orderGroupOrders')} /><TableListPageContent><OrderGroupList /></TableListPageContent></>;
}
