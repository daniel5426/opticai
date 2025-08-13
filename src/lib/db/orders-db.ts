/// <reference path="../../types/electron.d.ts" />
import { Order } from './schema-interface';
import { apiClient } from '../api-client';

export async function getOrdersByClientId(clientId: number): Promise<Order[]> {
  try {
    const response = await apiClient.getOrdersByClient(clientId);
    if (response.error) {
      console.error('Error getting orders by client:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error getting orders by client:', error);
    return [];
  }
}

export async function getAllOrders(clinicId?: number): Promise<Order[]> {
  try {
    const response = await apiClient.getOrders(clinicId);
    if (response.error) {
      console.error('Error getting all orders:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error getting all orders:', error);
    return [];
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

 