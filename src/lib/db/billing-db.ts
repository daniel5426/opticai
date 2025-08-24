/// <reference path="../../types/electron.d.ts" />
import { Billing, OrderLineItem } from './schema-interface';
import { apiClient } from '../api-client';

export async function getBillingByOrderId(orderId: number): Promise<Billing | null> {
  try {
    const response = await apiClient.getBillingByOrder(orderId);
    if (response.error) {
      console.error('Error getting billing by order:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error getting billing by order:', error);
    return null;
  }
}

export async function getOrderLineItemsByBillingId(billingId: number): Promise<OrderLineItem[]> {
  try {
    const response = await apiClient.getOrderLineItems(billingId);
    if ((response as any).error) {
      console.error('Error getting order line items:', (response as any).error);
      return [];
    }
    return (response as any).data || [];
  } catch (error) {
    console.error('Error getting order line items:', error);
    return [];
  }
}

export async function getBillingByContactLensId(contactLensId: number): Promise<Billing | null> {
  try {
    const response = await apiClient.getBillingByContactLens(contactLensId);
    if ((response as any).error) {
      console.error('Error getting billing by contact lens:', (response as any).error);
      return null;
    }
    return (response as any).data || null;
  } catch (error) {
    console.error('Error getting billing by contact lens:', error);
    return null;
  }
}

export async function createBilling(billing: Omit<Billing, 'id'>): Promise<Billing | null> {
  try {
    const response = await apiClient.createBilling(billing);
    if (response.error) {
      console.error('Error creating billing:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error creating billing:', error);
    return null;
  }
}

export async function updateBilling(billing: Billing): Promise<Billing | null> {
  try {
    if (!billing.id) {
      console.error('Error updating billing: No billing ID provided');
      return null;
    }
    const response = await apiClient.updateBilling(billing.id, billing);
    if (response.error) {
      console.error('Error updating billing:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error updating billing:', error);
    return null;
  }
}

export async function createOrderLineItem(orderLineItem: Omit<OrderLineItem, 'id'>): Promise<OrderLineItem | null> {
  try {
    const response = await apiClient.createOrderLineItem(orderLineItem);
    if ((response as any).error) {
      console.error('Error creating order line item:', (response as any).error);
      return null;
    }
    return (response as any).data || null;
  } catch (error) {
    console.error('Error creating order line item:', error);
    return null;
  }
}

export async function updateOrderLineItem(orderLineItem: OrderLineItem): Promise<OrderLineItem | null> {
  try {
    if (!orderLineItem.id) return null;
    const response = await apiClient.updateOrderLineItem(orderLineItem.id, orderLineItem);
    if ((response as any).error) {
      console.error('Error updating order line item:', (response as any).error);
      return null;
    }
    return (response as any).data || null;
  } catch (error) {
    console.error('Error updating order line item:', error);
    return null;
  }
}

export async function deleteOrderLineItem(orderLineItemId: number): Promise<boolean> {
  try {
    const response = await apiClient.deleteOrderLineItem(orderLineItemId);
    if ((response as any).error) {
      console.error('Error deleting order line item:', (response as any).error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting order line item:', error);
    return false;
  }
} 