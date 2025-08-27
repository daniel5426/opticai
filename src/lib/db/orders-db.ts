/// <reference path="../../types/electron.d.ts" />
import { Order, ContactLensOrder } from './schema-interface';
import { apiClient } from '../api-client';

export async function getOrdersByClientId(clientId: number): Promise<Order[]> {
  try {
    const [oRes, clRes] = await Promise.all([
      apiClient.getOrdersByClient(clientId),
      apiClient.getContactLensOrdersByClient(clientId)
    ]);
    const orders: Order[] = (oRes.data || []) as Order[];
    const contactLensOrders = (clRes.data || []) as unknown as ContactLensOrder[];
    const normalizedContactOrders: Order[] = contactLensOrders.map((cl: any) => ({
      id: cl.id,
      client_id: cl.client_id,
      clinic_id: cl.clinic_id,
      order_date: cl.order_date,
      type: cl.type || 'עדשות מגע',
      user_id: cl.user_id,
      order_data: cl.order_data,
      comb_va: undefined,
      comb_high: undefined,
      comb_pd: undefined,
      __contact: true,
    } as any));
    return [...orders, ...normalizedContactOrders];
  } catch (error) {
    console.error('Error getting orders by client:', error);
    return [];
  }
}

export async function getAllOrders(clinicId?: number): Promise<Order[]> {
  try {
    const [oRes, clRes] = await Promise.all([
      apiClient.getOrders(clinicId),
      apiClient.getContactLensOrders(clinicId)
    ]);
    const orders: Order[] = (oRes.data || []) as Order[];
    const contactLensOrders = (clRes.data || []) as unknown as ContactLensOrder[];
    const normalizedContactOrders: Order[] = contactLensOrders.map((cl: any) => ({
      id: cl.id,
      client_id: cl.client_id,
      clinic_id: cl.clinic_id,
      order_date: cl.order_date,
      type: cl.type || 'עדשות מגע',
      user_id: cl.user_id,
      order_data: cl.order_data,
      comb_va: undefined,
      comb_high: undefined,
      comb_pd: undefined,
      __contact: true,
    } as any));
    return [...orders, ...normalizedContactOrders];
  } catch (error) {
    console.error('Error getting all orders:', error);
    return [];
  }
}

export async function getPaginatedOrders(
  clinicId?: number,
  options?: { limit?: number; offset?: number; order?: 'date_desc' | 'date_asc' | 'id_desc' | 'id_asc'; search?: string }
): Promise<{ items: Order[]; total: number }> {
  try {
    const effectiveOptions = options ?? { limit: 25, offset: 0, order: 'date_desc' as const };
    const response = await apiClient.getOrdersPaginated(clinicId, effectiveOptions);
    if (response.error) {
      console.error('Error getting paginated orders:', response.error);
      return { items: [], total: 0 };
    }
    return response.data || { items: [], total: 0 };
  } catch (error) {
    console.error('Error getting paginated orders:', error);
    return { items: [], total: 0 };
  }
}

export async function getOrderById(orderId: number): Promise<Order | null> {
  try {
    const response = await apiClient.getOrder(orderId);
    if (response.error) {
      console.error('Error getting order:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error getting order:', error);
    return null;
  }
}

export async function getContactLensOrderById(orderId: number): Promise<ContactLensOrder | null> {
  try {
    const response = await apiClient.getContactLensOrder(orderId);
    if ((response as any).error) {
      console.error('Error getting contact lens order:', (response as any).error);
      return null;
    }
    return (response as any).data || null;
  } catch (error) {
    console.error('Error getting contact lens order:', error);
    return null;
  }
}

export async function createOrder(order: Omit<Order, 'id'>): Promise<Order | null> {
  try {
    const response = await apiClient.createOrder(order);
    if (response.error) {
      console.error('Error creating order:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error creating order:', error);
    return null;
  }
}

export async function updateOrder(order: Order): Promise<Order | null> {
  try {
    if (!order.id) {
      console.error('Error updating order: No order ID provided');
      return null;
    }
    const response = await apiClient.updateOrder(order.id, order);
    if (response.error) {
      console.error('Error updating order:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error updating order:', error);
    return null;
  }
}

export async function upsertOrderFull(payload: any): Promise<any | null> {
  try {
    const response = await apiClient.upsertOrderFull(payload);
    if ((response as any).error) {
      console.error('Error upserting order full:', (response as any).error);
      return null;
    }
    return (response as any).data || null;
  } catch (error) {
    console.error('Error upserting order full:', error);
    return null;
  }
}

export async function deleteOrder(orderId: number): Promise<boolean> {
  try {
    const response = await apiClient.deleteOrder(orderId);
    if (response.error) {
      console.error('Error deleting order:', response.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting order:', error);
    return false;
  }
}

export async function upsertContactLensOrderFull(payload: any): Promise<any | null> {
  try {
    const response = await apiClient.upsertContactLensOrderFull(payload);
    if ((response as any).error) {
      console.error('Error upserting contact lens order full:', (response as any).error);
      return null;
    }
    return (response as any).data || null;
  } catch (error) {
    console.error('Error upserting contact lens order full:', error);
    return null;
  }
}

 