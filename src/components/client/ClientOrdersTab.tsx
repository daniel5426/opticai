import React from "react";
import { useParams } from "@tanstack/react-router";
import { OrderGroupList } from "@/components/order-groups/OrderGroupList";

interface ClientOrdersTabProps {
  enabled?: boolean;
}

export function ClientOrdersTab({ enabled = true }: ClientOrdersTabProps) {
  const { clientId } = useParams({ from: "/clients/$clientId" });
  return <OrderGroupList clientId={Number(clientId)} enabled={enabled} />;
}
