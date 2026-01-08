import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CustomModal } from '@/components/ui/custom-modal';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Order } from '@/lib/db/schema-interface';
import { getOrdersByClientId } from '@/lib/db/orders-db';
import { Loader2, Search } from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface OrdersHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId: number;
    onSelectOrder: (order: Order) => void;
}

const ITEMS_PER_PAGE = 15;

export function OrdersHistoryModal({ isOpen, onClose, clientId, onSelectOrder }: OrdersHistoryModalProps) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [dateFilter, setDateFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && clientId) {
            loadOrders();
        }
    }, [isOpen, clientId]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadOrders = async () => {
        setLoading(true);
        try {
            console.log('[OrdersHistoryModal] Loading orders for clientId:', clientId);
            const data = await getOrdersByClientId(clientId);
            console.log('[OrdersHistoryModal] Loaded orders:', data.length, data);
            // Sort by date descending
            const sorted = data.sort((a, b) => {
                const dateA = a.order_date ? new Date(a.order_date).getTime() : 0;
                const dateB = b.order_date ? new Date(b.order_date).getTime() : 0;
                return dateB - dateA;
            });
            setOrders(sorted);
        } catch (error) {
            console.error("Failed to load orders", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            // Filter by Type
            if (typeFilter !== 'all') {
                const isContact = Boolean((order as any).__contact);
                if (typeFilter === 'contact' && !isContact) return false;
                if (typeFilter === 'regular' && isContact) return false;
            }

            // Filter by partial date match (simple string match for now as per prompt "input text for filtering")
            if (dateFilter) {
                const orderDate = order.order_date ? format(new Date(order.order_date), 'dd/MM/yyyy') : '';
                if (!orderDate.includes(dateFilter)) return false;
            }

            return true;
        });
    }, [orders, typeFilter, dateFilter]);

    const displayedOrders = filteredOrders.slice(0, displayCount);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 50) {
            if (displayCount < filteredOrders.length) {
                setDisplayCount(prev => prev + ITEMS_PER_PAGE);
            }
        }
    };

    // Reset display count when filters change
    useEffect(() => {
        setDisplayCount(ITEMS_PER_PAGE);
        if (listRef.current) {
            listRef.current.scrollTop = 0;
        }
    }, [typeFilter, dateFilter]);

    return (
        <CustomModal
            isOpen={isOpen}
            onClose={onClose}
            title="היסטוריית הזמנות"
            width="w-[600px] max-w-2xl"
            showCloseButton={true}
            className='h-[80vh]'
        >
            <div className="flex flex-col h-full gap-4">
                {/* Filters Header */}
                <div className="grid grid-cols-2 gap-4 p-1">
                    <Select value={typeFilter} onValueChange={setTypeFilter} dir="rtl">
                        <SelectTrigger>
                            <SelectValue placeholder="סוג הזמנה" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">הכל</SelectItem>
                            <SelectItem value="regular">משקפיים</SelectItem>
                            <SelectItem value="contact">עדשות מגע</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="relative">
                        <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="חפש לפי תאריך (dd/mm/yyyy)..."
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="pr-8"
                            dir="rtl"
                        />
                    </div>
                </div>

                {/* List */}
                <div
                    className="flex-1 overflow-y-auto space-y-2 pr-2"
                    onScroll={handleScroll}
                    ref={listRef}
                    style={{ scrollbarWidth: 'thin' }}
                >
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : displayedOrders.length === 0 ? (
                        <div className="text-center text-muted-foreground p-8">
                            לא נמצאו הזמנות
                        </div>
                    ) : (
                        displayedOrders.map((order, idx) => {
                            const isContact = Boolean((order as any).__contact);
                            const date = order.order_date ? new Date(order.order_date) : null;
                            const formattedDate = date ? format(date, 'dd/MM/yyyy', { locale: he }) : '-';

                            return (
                                <div
                                    key={`${order.id}-${idx}`}
                                    className="p-3 border rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors flex justify-between items-center bg-card"
                                    onClick={() => onSelectOrder(order)}
                                >
                                    <div>
                                        <div className="font-semibold text-sm">
                                            {isContact ? 'עדשות מגע' : 'משקפיים'}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {order.type || '-'}
                                        </div>
                                    </div>
                                    <div className="text-left font-mono text-sm">
                                        {formattedDate}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </CustomModal>
    );
}
