/// <reference path="../../types/electron.d.ts" />
import { Order, OrderEye, OrderLens, Frame, OrderDetails } from './schema'

export async function getOrdersByClientId(clientId: number): Promise<Order[]> {
  try {
    return await window.electronAPI.getOrdersByClient(clientId);
  } catch (error) {
    console.error('Error getting orders by client:', error);
    return [];
  }
}

export async function getAllOrders(): Promise<Order[]> {
  try {
    return await window.electronAPI.getAllOrders();
  } catch (error) {
    console.error('Error getting all orders:', error);
    return [];
  }
}

export async function getOrderById(orderId: number): Promise<Order | undefined> {
  try {
    return await window.electronAPI.getOrder(orderId);
  } catch (error) {
    console.error('Error getting order:', error);
    return undefined;
  }
}

export async function getOrderEyesByOrderId(orderId: number): Promise<OrderEye[]> {
  try {
    return await window.electronAPI.getOrderEyesByOrder(orderId);
  } catch (error) {
    console.error('Error getting order eyes:', error);
    return [];
  }
}

export async function getOrderLensByOrderId(orderId: number): Promise<OrderLens | undefined> {
  try {
    return await window.electronAPI.getOrderLensByOrder(orderId);
  } catch (error) {
    console.error('Error getting order lens:', error);
    return undefined;
  }
}

export async function getFrameByOrderId(orderId: number): Promise<Frame | undefined> {
  try {
    return await window.electronAPI.getFrameByOrder(orderId);
  } catch (error) {
    console.error('Error getting frame:', error);
    return undefined;
  }
}

export async function createOrder(order: Omit<Order, 'id'>): Promise<Order | null> {
  try {
    return await window.electronAPI.createOrder(order);
  } catch (error) {
    console.error('Error creating order:', error);
    return null;
  }
}

export async function createOrderEye(orderEye: Omit<OrderEye, 'id'>): Promise<OrderEye | null> {
  try {
    return await window.electronAPI.createOrderEye(orderEye);
  } catch (error) {
    console.error('Error creating order eye:', error);
    return null;
  }
}

export async function createOrderLens(orderLens: Omit<OrderLens, 'id'>): Promise<OrderLens | null> {
  try {
    return await window.electronAPI.createOrderLens(orderLens);
  } catch (error) {
    console.error('Error creating order lens:', error);
    return null;
  }
}

export async function createFrame(frame: Omit<Frame, 'id'>): Promise<Frame | null> {
  try {
    return await window.electronAPI.createFrame(frame);
  } catch (error) {
    console.error('Error creating frame:', error);
    return null;
  }
}

export async function updateOrder(order: Order): Promise<Order | undefined> {
  try {
    return await window.electronAPI.updateOrder(order);
  } catch (error) {
    console.error('Error updating order:', error);
    return undefined;
  }
}

export async function updateOrderEye(orderEye: OrderEye): Promise<OrderEye | undefined> {
  try {
    return await window.electronAPI.updateOrderEye(orderEye);
  } catch (error) {
    console.error('Error updating order eye:', error);
    return undefined;
  }
}

export async function updateOrderLens(orderLens: OrderLens): Promise<OrderLens | undefined> {
  try {
    return await window.electronAPI.updateOrderLens(orderLens);
  } catch (error) {
    console.error('Error updating order lens:', error);
    return undefined;
  }
}

export async function updateFrame(frame: Frame): Promise<Frame | undefined> {
  try {
    return await window.electronAPI.updateFrame(frame);
  } catch (error) {
    console.error('Error updating frame:', error);
    return undefined;
  }
}

export async function deleteOrder(orderId: number): Promise<boolean> {
  try {
    return await window.electronAPI.deleteOrder(orderId);
  } catch (error) {
    console.error('Error deleting order:', error);
    return false;
  }
}

export async function getOrderDetailsByOrderId(orderId: number): Promise<OrderDetails | undefined> {
  try {
    return await window.electronAPI.getOrderDetailsByOrder(orderId);
  } catch (error) {
    console.error('Error getting order details:', error);
    return undefined;
  }
}

export async function createOrderDetails(orderDetails: Omit<OrderDetails, 'id'>): Promise<OrderDetails | null> {
  try {
    return await window.electronAPI.createOrderDetails(orderDetails);
  } catch (error) {
    console.error('Error creating order details:', error);
    return null;
  }
}

export async function updateOrderDetails(orderDetails: OrderDetails): Promise<OrderDetails | undefined> {
  try {
    return await window.electronAPI.updateOrderDetails(orderDetails);
  } catch (error) {
    console.error('Error updating order details:', error);
    return undefined;
  }
} 