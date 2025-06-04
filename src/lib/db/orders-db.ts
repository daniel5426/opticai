import { Order, OrderEye, OrderLens, Frame } from './schema'

const ordersData: Order[] = [
  {
    id: 1,
    exam_id: 1,
    order_date: '2024-01-15',
    type: 'משקפי ראייה',
    lens_id: 1,
    frame_id: 1,
    comb_va: 6,
    comb_high: 18,
    comb_pd: 63
  },
  {
    id: 2,
    exam_id: 2,
    order_date: '2024-02-20',
    type: 'משקפי קריאה',
    lens_id: 2,
    frame_id: 2,
    comb_va: 8,
    comb_high: 16,
    comb_pd: 61
  }
]

const orderEyesData: OrderEye[] = [
  // Order 1 - Right Eye
  {
    id: 1,
    order_id: 1,
    eye: 'R',
    sph: -2.25,
    cyl: -0.75,
    ax: 180,
    pris: 0,
    base: '',
    va: '6/6',
    ad: 2.00,
    diam: 70,
    s_base: 4,
    high: 18,
    pd: 32
  },
  // Order 1 - Left Eye
  {
    id: 2,
    order_id: 1,
    eye: 'L',
    sph: -2.50,
    cyl: -0.50,
    ax: 175,
    pris: 0,
    base: '',
    va: '6/6',
    ad: 2.00,
    diam: 70,
    s_base: 4,
    high: 18,
    pd: 31
  },
  // Order 2 - Right Eye
  {
    id: 3,
    order_id: 2,
    eye: 'R',
    sph: 1.50,
    cyl: 0,
    ax: 0,
    pris: 0,
    base: '',
    va: '6/9',
    ad: 2.50,
    diam: 65,
    s_base: 4,
    high: 16,
    pd: 30.5
  },
  // Order 2 - Left Eye
  {
    id: 4,
    order_id: 2,
    eye: 'L',
    sph: 1.75,
    cyl: 0,
    ax: 0,
    pris: 0,
    base: '',
    va: '6/9',
    ad: 2.50,
    diam: 65,
    s_base: 4,
    high: 16,
    pd: 30.5
  }
]

const orderLensesData: OrderLens[] = [
  {
    id: 1,
    order_id: 1,
    right_model: 'ZEISS Digital 1.67',
    left_model: 'ZEISS Digital 1.67',
    color: 'שקוף',
    coating: 'DuraVision Platinum',
    material: 'פלסטיק 1.67',
    supplier: 'ZEISS'
  },
  {
    id: 2,
    order_id: 2,
    right_model: 'HOYA LifeStyle 1.60',
    left_model: 'HOYA LifeStyle 1.60',
    color: 'חום 85%',
    coating: 'Hi-Vision LongLife',
    material: 'פלסטיק 1.60',
    supplier: 'HOYA'
  }
]

const framesData: Frame[] = [
  {
    id: 1,
    order_id: 1,
    color: 'שחור מט',
    supplier: 'משקפי שמש בע"מ',
    model: 'RB5228',
    manufacturer: 'Ray-Ban',
    supplied_by: 'חנות',
    bridge: 17,
    width: 140,
    height: 50,
    length: 145
  },
  {
    id: 2,
    order_id: 2,
    color: 'כחול שקוף',
    supplier: 'אופטיקה מרכזית',
    model: 'TF2168',
    manufacturer: 'Tom Ford',
    supplied_by: 'לקוח',
    bridge: 16,
    width: 135,
    height: 48,
    length: 140
  }
]

export function getOrdersByClientId(clientId: number): Order[] {
  const clientExams = JSON.parse(localStorage.getItem('exams') || '[]').filter((exam: any) => exam.client_id === clientId)
  const examIds = clientExams.map((exam: any) => exam.id)
  
  const orders = JSON.parse(localStorage.getItem('orders') || JSON.stringify(ordersData))
  return orders.filter((order: Order) => examIds.includes(order.exam_id))
}

export function getOrderById(orderId: number): Order | undefined {
  const orders = JSON.parse(localStorage.getItem('orders') || JSON.stringify(ordersData))
  return orders.find((order: Order) => order.id === orderId)
}

export function getOrderEyesByOrderId(orderId: number): OrderEye[] {
  const orderEyes = JSON.parse(localStorage.getItem('orderEyes') || JSON.stringify(orderEyesData))
  return orderEyes.filter((orderEye: OrderEye) => orderEye.order_id === orderId)
}

export function getOrderLensByOrderId(orderId: number): OrderLens | undefined {
  const orderLenses = JSON.parse(localStorage.getItem('orderLenses') || JSON.stringify(orderLensesData))
  return orderLenses.find((lens: OrderLens) => lens.order_id === orderId)
}

export function getFrameByOrderId(orderId: number): Frame | undefined {
  const frames = JSON.parse(localStorage.getItem('frames') || JSON.stringify(framesData))
  return frames.find((frame: Frame) => frame.order_id === orderId)
}

export function createOrder(order: Omit<Order, 'id'>): Order {
  const orders = JSON.parse(localStorage.getItem('orders') || JSON.stringify(ordersData))
  const maxId = orders.length > 0 ? Math.max(...orders.map((o: Order) => o.id || 0)) : 0
  const newOrder = { ...order, id: maxId + 1 }
  orders.push(newOrder)
  localStorage.setItem('orders', JSON.stringify(orders))
  return newOrder
}

export function createOrderEye(orderEye: Omit<OrderEye, 'id'>): OrderEye {
  const orderEyes = JSON.parse(localStorage.getItem('orderEyes') || JSON.stringify(orderEyesData))
  const maxId = orderEyes.length > 0 ? Math.max(...orderEyes.map((oe: OrderEye) => oe.id || 0)) : 0
  const newOrderEye = { ...orderEye, id: maxId + 1 }
  orderEyes.push(newOrderEye)
  localStorage.setItem('orderEyes', JSON.stringify(orderEyes))
  return newOrderEye
}

export function createOrderLens(orderLens: Omit<OrderLens, 'id'>): OrderLens {
  const orderLenses = JSON.parse(localStorage.getItem('orderLenses') || JSON.stringify(orderLensesData))
  const maxId = orderLenses.length > 0 ? Math.max(...orderLenses.map((ol: OrderLens) => ol.id || 0)) : 0
  const newOrderLens = { ...orderLens, id: maxId + 1 }
  orderLenses.push(newOrderLens)
  localStorage.setItem('orderLenses', JSON.stringify(orderLenses))
  return newOrderLens
}

export function createFrame(frame: Omit<Frame, 'id'>): Frame {
  const frames = JSON.parse(localStorage.getItem('frames') || JSON.stringify(framesData))
  const maxId = frames.length > 0 ? Math.max(...frames.map((f: Frame) => f.id || 0)) : 0
  const newFrame = { ...frame, id: maxId + 1 }
  frames.push(newFrame)
  localStorage.setItem('frames', JSON.stringify(frames))
  return newFrame
}

export function updateOrder(order: Order): Order {
  const orders = JSON.parse(localStorage.getItem('orders') || JSON.stringify(ordersData))
  const index = orders.findIndex((o: Order) => o.id === order.id)
  if (index !== -1) {
    orders[index] = order
    localStorage.setItem('orders', JSON.stringify(orders))
  }
  return order
}

export function updateOrderEye(orderEye: OrderEye): OrderEye {
  const orderEyes = JSON.parse(localStorage.getItem('orderEyes') || JSON.stringify(orderEyesData))
  const index = orderEyes.findIndex((oe: OrderEye) => oe.id === orderEye.id)
  if (index !== -1) {
    orderEyes[index] = orderEye
    localStorage.setItem('orderEyes', JSON.stringify(orderEyes))
  }
  return orderEye
}

export function updateOrderLens(orderLens: OrderLens): OrderLens {
  const orderLenses = JSON.parse(localStorage.getItem('orderLenses') || JSON.stringify(orderLensesData))
  const index = orderLenses.findIndex((ol: OrderLens) => ol.id === orderLens.id)
  if (index !== -1) {
    orderLenses[index] = orderLens
    localStorage.setItem('orderLenses', JSON.stringify(orderLenses))
  }
  return orderLens
}

export function updateFrame(frame: Frame): Frame {
  const frames = JSON.parse(localStorage.getItem('frames') || JSON.stringify(framesData))
  const index = frames.findIndex((f: Frame) => f.id === frame.id)
  if (index !== -1) {
    frames[index] = frame
    localStorage.setItem('frames', JSON.stringify(frames))
  }
  return frame
} 