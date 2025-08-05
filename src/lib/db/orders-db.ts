/// <reference path="../../types/electron.d.ts" />
import { Order, OrderEye, OrderLens, Frame, OrderDetails } from './schema-interface';
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

export async function getOrderEyesByOrderId(orderId: number): Promise<OrderEye[]> {
  try {
    // This would need a specific endpoint in the API
    console.warn('getOrderEyesByOrderId: API endpoint not yet implemented');
    return [];
  } catch (error) {
    console.error('Error getting order eyes:', error);
    return [];
  }
}

export async function getOrderLensByOrderId(orderId: number): Promise<OrderLens | null> {
  try {
    // This would need a specific endpoint in the API
    console.warn('getOrderLensByOrderId: API endpoint not yet implemented');
    return null;
  } catch (error) {
    console.error('Error getting order lens:', error);
    return null;
  }
}

export async function getFrameByOrderId(orderId: number): Promise<Frame | null> {
  try {
    // This would need a specific endpoint in the API
    console.warn('getFrameByOrderId: API endpoint not yet implemented');
    return null;
  } catch (error) {
    console.error('Error getting frame:', error);
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

export async function createOrderEye(orderEye: Omit<OrderEye, 'id'>): Promise<OrderEye | null> {
  try {
    // This would need a specific endpoint in the API
    console.warn('createOrderEye: API endpoint not yet implemented');
    return null;
  } catch (error) {
    console.error('Error creating order eye:', error);
    return null;
  }
}

export async function createOrderLens(orderLens: Omit<OrderLens, 'id'>): Promise<OrderLens | null> {
  try {
    // This would need a specific endpoint in the API
    console.warn('createOrderLens: API endpoint not yet implemented');
    return null;
  } catch (error) {
    console.error('Error creating order lens:', error);
    return null;
  }
}

export async function createFrame(frame: Omit<Frame, 'id'>): Promise<Frame | null> {
  try {
    // This would need a specific endpoint in the API
    console.warn('createFrame: API endpoint not yet implemented');
    return null;
  } catch (error) {
    console.error('Error creating frame:', error);
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

export async function updateOrderEye(orderEye: OrderEye): Promise<OrderEye | null> {
  try {
    // This would need a specific endpoint in the API
    console.warn('updateOrderEye: API endpoint not yet implemented');
    return null;
  } catch (error) {
    console.error('Error updating order eye:', error);
    return null;
  }
}

export async function updateOrderLens(orderLens: OrderLens): Promise<OrderLens | null> {
  try {
    // This would need a specific endpoint in the API
    console.warn('updateOrderLens: API endpoint not yet implemented');
    return null;
  } catch (error) {
    console.error('Error updating order lens:', error);
    return null;
  }
}

export async function updateFrame(frame: Frame): Promise<Frame | null> {
  try {
    // This would need a specific endpoint in the API
    console.warn('updateFrame: API endpoint not yet implemented');
    return null;
  } catch (error) {
    console.error('Error updating frame:', error);
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

export async function getOrderDetailsByOrderId(orderId: number): Promise<OrderDetails | null> {
  try {
    // This would need a specific endpoint in the API
    console.warn('getOrderDetailsByOrderId: API endpoint not yet implemented');
    return null;
  } catch (error) {
    console.error('Error getting order details:', error);
    return null;
  }
}

export async function createOrderDetails(orderDetails: Omit<OrderDetails, 'id'>): Promise<OrderDetails | null> {
  try {
    // This would need a specific endpoint in the API
    console.warn('createOrderDetails: API endpoint not yet implemented');
    return null;
  } catch (error) {
    console.error('Error creating order details:', error);
    return null;
  }
}

export async function updateOrderDetails(orderDetails: OrderDetails): Promise<OrderDetails | null> {
  try {
    // This would need a specific endpoint in the API
    console.warn('updateOrderDetails: API endpoint not yet implemented');
    return null;
  } catch (error) {
    console.error('Error updating order details:', error);
    return null;
  }
} 