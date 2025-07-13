/// <reference path="../../types/electron.d.ts" />
import { Order, OrderEye, OrderLens, Frame, OrderDetails } from './schema'

export async function getOrdersByClientId(clientId: number): Promise<Order[]> {
  try {
    return await window.electronAPI.db('getOrdersByClientId', clientId);
  } catch (error) {
    console.error('Error getting orders by client:', error);
    return [];
  }
}

export async function getAllOrders(): Promise<Order[]> {
  try {
    return await window.electronAPI.db('getAllOrders');
  } catch (error) {
    console.error('Error getting all orders:', error);
    return [];
  }
}

export async function getOrderById(orderId: number): Promise<Order | undefined> {
  try {
    return await window.electronAPI.db('getOrderById', orderId);
  } catch (error) {
    console.error('Error getting order:', error);
    return undefined;
  }
}

export async function getOrderEyesByOrderId(orderId: number): Promise<OrderEye[]> {
  try {
    return await window.electronAPI.db('getOrderEyesByOrderId', orderId);
  } catch (error) {
    console.error('Error getting order eyes:', error);
    return [];
  }
}

export async function getOrderLensByOrderId(orderId: number): Promise<OrderLens | undefined> {
  try {
    return await window.electronAPI.db('getOrderLensByOrderId', orderId);
  } catch (error) {
    console.error('Error getting order lens:', error);
    return undefined;
  }
}

export async function getFrameByOrderId(orderId: number): Promise<Frame | undefined> {
  try {
    return await window.electronAPI.db('getFrameByOrderId', orderId);
  } catch (error) {
    console.error('Error getting frame:', error);
    return undefined;
  }
}

export async function createOrder(order: Omit<Order, 'id'>): Promise<Order | null> {
  try {
    const result = await window.electronAPI.db('createOrder', order);
    if (result && order.client_id) {
      await window.electronAPI.db('updateClientUpdatedDate', order.client_id);
      await window.electronAPI.db('updateClientPartUpdatedDate', order.client_id, 'order');
    }
    return result;
  } catch (error) {
    console.error('Error creating order:', error);
    return null;
  }
}

export async function createOrderEye(orderEye: Omit<OrderEye, 'id'>): Promise<OrderEye | null> {
  try {
    return await window.electronAPI.db('createOrderEye', orderEye);
  } catch (error) {
    console.error('Error creating order eye:', error);
    return null;
  }
}

export async function createOrderLens(orderLens: Omit<OrderLens, 'id'>): Promise<OrderLens | null> {
  try {
    return await window.electronAPI.db('createOrderLens', orderLens);
  } catch (error) {
    console.error('Error creating order lens:', error);
    return null;
  }
}

export async function createFrame(frame: Omit<Frame, 'id'>): Promise<Frame | null> {
  try {
    return await window.electronAPI.db('createFrame', frame);
  } catch (error) {
    console.error('Error creating frame:', error);
    return null;
  }
}

export async function updateOrder(order: Order): Promise<Order | undefined> {
  try {
    const result = await window.electronAPI.db('updateOrder', order);
    if (result && order.client_id) {
      await window.electronAPI.db('updateClientUpdatedDate', order.client_id);
      await window.electronAPI.db('updateClientPartUpdatedDate', order.client_id, 'order');
    }
    return result;
  } catch (error) {
    console.error('Error updating order:', error);
    return undefined;
  }
}

export async function updateOrderEye(orderEye: OrderEye): Promise<OrderEye | undefined> {
  try {
    return await window.electronAPI.db('updateOrderEye', orderEye);
  } catch (error) {
    console.error('Error updating order eye:', error);
    return undefined;
  }
}

export async function updateOrderLens(orderLens: OrderLens): Promise<OrderLens | undefined> {
  try {
    return await window.electronAPI.db('updateOrderLens', orderLens);
  } catch (error) {
    console.error('Error updating order lens:', error);
    return undefined;
  }
}

export async function updateFrame(frame: Frame): Promise<Frame | undefined> {
  try {
    return await window.electronAPI.db('updateFrame', frame);
  } catch (error) {
    console.error('Error updating frame:', error);
    return undefined;
  }
}

export async function deleteOrder(orderId: number): Promise<boolean> {
  try {
    const order = await window.electronAPI.db('getOrderById', orderId);
    const result = await window.electronAPI.db('deleteOrder', orderId);
    if (result && order?.client_id) {
      await window.electronAPI.db('updateClientUpdatedDate', order.client_id);
      await window.electronAPI.db('updateClientPartUpdatedDate', order.client_id, 'order');
    }
    return result;
  } catch (error) {
    console.error('Error deleting order:', error);
    return false;
  }
}

export async function getOrderDetailsByOrderId(orderId: number): Promise<OrderDetails | undefined> {
  try {
    return await window.electronAPI.db('getOrderDetailsByOrderId', orderId);
  } catch (error) {
    console.error('Error getting order details:', error);
    return undefined;
  }
}

export async function createOrderDetails(orderDetails: Omit<OrderDetails, 'id'>): Promise<OrderDetails | null> {
  try {
    return await window.electronAPI.db('createOrderDetails', orderDetails);
  } catch (error) {
    console.error('Error creating order details:', error);
    return null;
  }
}

export async function updateOrderDetails(orderDetails: OrderDetails): Promise<OrderDetails | undefined> {
  try {
    return await window.electronAPI.db('updateOrderDetails', orderDetails);
  } catch (error) {
    console.error('Error updating order details:', error);
    return undefined;
  }
} 