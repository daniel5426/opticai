/// <reference path="../../types/electron.d.ts" />
import { Billing, BillingPayment, OrderLineItem } from './schema-interface';
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

export async function getBillingById(billingId: number): Promise<Billing | null> {
  try {
    const response = await apiClient.getBilling(billingId);
    if (response.error) {
      console.error('Error getting billing:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error getting billing:', error);
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

export async function getBillingPayments(billingId: number): Promise<BillingPayment[]> {
  try {
    const response = await apiClient.getBillingPayments(billingId);
    if ((response as any).error) {
      console.error('Error getting billing payments:', (response as any).error);
      return [];
    }
    return (response as any).data || [];
  } catch (error) {
    console.error('Error getting billing payments:', error);
    return [];
  }
}

export async function createBillingPayment(
  billingId: number,
  payment: Omit<BillingPayment, 'id' | 'billing_id' | 'created_at'>,
): Promise<BillingPayment | null> {
  try {
    const response = await apiClient.createBillingPayment(billingId, payment);
    if ((response as any).error) {
      console.error('Error creating billing payment:', (response as any).error);
      return null;
    }
    return (response as any).data || null;
  } catch (error) {
    console.error('Error creating billing payment:', error);
    return null;
  }
}

export async function deleteBillingPayment(billingId: number, paymentId: number): Promise<boolean> {
  try {
    const response = await apiClient.deleteBillingPayment(billingId, paymentId);
    if ((response as any).error) {
      console.error('Error deleting billing payment:', (response as any).error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting billing payment:', error);
    return false;
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
