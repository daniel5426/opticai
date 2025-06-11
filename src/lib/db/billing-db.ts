/// <reference path="../../types/electron.d.ts" />
import { Billing, OrderLineItem } from './schema'

export async function getBillingByOrderId(orderId: number): Promise<Billing | undefined> {
  try {
    return await window.electronAPI.getBillingByOrder(orderId);
  } catch (error) {
    console.error('Error getting billing by order:', error);
    return undefined;
  }
}

export async function getOrderLineItemsByBillingId(billingId: number): Promise<OrderLineItem[]> {
  try {
    return await window.electronAPI.getOrderLineItemsByBilling(billingId);
  } catch (error) {
    console.error('Error getting order line items by billing:', error);
    return [];
  }
}

export async function createBilling(billing: Omit<Billing, 'id'>): Promise<Billing | null> {
  try {
    return await window.electronAPI.createBilling(billing);
  } catch (error) {
    console.error('Error creating billing:', error);
    return null;
  }
}

export async function updateBilling(billing: Billing): Promise<Billing | undefined> {
  try {
    return await window.electronAPI.updateBilling(billing);
  } catch (error) {
    console.error('Error updating billing:', error);
    return undefined;
  }
}

export async function createOrderLineItem(orderLineItem: Omit<OrderLineItem, 'id'>): Promise<OrderLineItem | null> {
  try {
    return await window.electronAPI.createOrderLineItem(orderLineItem);
  } catch (error) {
    console.error('Error creating order line item:', error);
    return null;
  }
}

export async function updateOrderLineItem(orderLineItem: OrderLineItem): Promise<OrderLineItem | undefined> {
  try {
    return await window.electronAPI.updateOrderLineItem(orderLineItem);
  } catch (error) {
    console.error('Error updating order line item:', error);
    return undefined;
  }
}

export async function deleteOrderLineItem(orderLineItemId: number): Promise<boolean> {
  try {
    return await window.electronAPI.deleteOrderLineItem(orderLineItemId);
  } catch (error) {
    console.error('Error deleting order line item:', error);
    return false;
  }
} 