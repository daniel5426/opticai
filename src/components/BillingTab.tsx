import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { NotesCard } from "@/components/ui/notes-card"
import { Plus, Edit, Trash2, Save, X } from "lucide-react"
import { Billing, OrderLineItem } from "@/lib/db/schema-interface"

interface BillingTabProps {
  billingFormData: Billing;
  setBillingFormData: React.Dispatch<React.SetStateAction<Billing>>;
  orderLineItems: OrderLineItem[];
  setOrderLineItems: React.Dispatch<React.SetStateAction<OrderLineItem[]>>;
  isEditing: boolean;
  handleDeleteOrderLineItem: (id: number) => void;
}

export function BillingTab({
  billingFormData,
  setBillingFormData,
  orderLineItems,
  setOrderLineItems,
  isEditing,
  handleDeleteOrderLineItem
}: BillingTabProps) {
  const [editingLineId, setEditingLineId] = useState<number | null>(null);

  // Auto-calculate total from line items
  React.useEffect(() => {
    if (!isEditing) return;

    const sum = orderLineItems.reduce((acc, item) => acc + (item.line_total || 0), 0);
    if (Math.abs(sum - (billingFormData.total_before_discount || 0)) > 0.01) {
      setBillingFormData(prev => {
        const next = { ...prev, total_before_discount: sum };
        // Recalculate after discount
        if (next.discount_percent) {
          const discountAmount = (sum * next.discount_percent) / 100;
          next.discount_amount = Math.round(discountAmount * 100) / 100;
          next.total_after_discount = sum - discountAmount;
        } else if (next.discount_amount) {
          next.total_after_discount = sum - next.discount_amount;
          const discountPercent = (next.discount_amount / sum) * 100;
          next.discount_percent = isNaN(discountPercent) ? undefined : Math.round(discountPercent * 100) / 100;
        } else {
          next.total_after_discount = sum;
        }
        return next;
      });
    }
  }, [orderLineItems, isEditing]);

  const handleBillingInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    const numericFields = ['total_before_discount', 'discount_amount', 'discount_percent', 'total_after_discount', 'prepayment_amount', 'installment_count'];
    if (numericFields.includes(name)) {
      const numValue = parseFloat(value);
      setBillingFormData(prev => {
        const newData = { ...prev, [name]: value === '' || isNaN(numValue) ? undefined : numValue };

        if (name === 'discount_amount' && newData.total_before_discount) {
          const discountPercent = (numValue / newData.total_before_discount) * 100;
          newData.discount_percent = isNaN(discountPercent) ? undefined : Math.round(discountPercent * 100) / 100;
          newData.total_after_discount = newData.total_before_discount - numValue;
        } else if (name === 'discount_percent' && newData.total_before_discount) {
          const discountAmount = (newData.total_before_discount * numValue) / 100;
          newData.discount_amount = isNaN(discountAmount) ? undefined : Math.round(discountAmount * 100) / 100;
          newData.total_after_discount = newData.total_before_discount - discountAmount;
        } else if (name === 'total_before_discount') {
          if (newData.discount_percent) {
            const discountAmount = (numValue * newData.discount_percent) / 100;
            newData.discount_amount = Math.round(discountAmount * 100) / 100;
            newData.total_after_discount = numValue - discountAmount;
          } else if (newData.discount_amount) {
            newData.total_after_discount = numValue - newData.discount_amount;
            const discountPercent = (newData.discount_amount / numValue) * 100;
            newData.discount_percent = Math.round(discountPercent * 100) / 100;
          }
        }

        return newData;
      });
    } else {
      setBillingFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleLineItemChange = (id: number, field: keyof OrderLineItem, value: string) => {
    setOrderLineItems(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item };
        const numericFields = ['price', 'quantity', 'discount'];
        if (numericFields.includes(field)) {
          const numValue = parseFloat(value);
          (updatedItem as any)[field] = value === '' || isNaN(numValue) ? undefined : numValue;
        } else if (field === 'supplied') {
          (updatedItem as any)[field] = value === 'true';
        } else {
          (updatedItem as any)[field] = value;
        }

        if (field === 'price' || field === 'quantity' || field === 'discount') {
          const price = updatedItem.price || 0;
          const quantity = updatedItem.quantity || 0;
          const discount = updatedItem.discount || 0;
          updatedItem.line_total = (price * quantity) - discount;
        }

        return updatedItem;
      }
      return item;
    }));
  };

  const addNewLineItem = () => {
    const tempId = -(Math.max(0, ...orderLineItems.map(item => Math.abs(item.id || 0))) + 1);
    const itemToAdd: OrderLineItem = {
      id: tempId,
      billings_id: billingFormData.id || 0,
      description: '',
      sku: '',
      price: 0,
      quantity: 1,
      discount: 0,
      supplied_by: '',
      supplied: false,
      line_total: 0
    };
    
    setOrderLineItems(prev => {
      const newItems = [...prev, itemToAdd];
      return newItems;
    });
    setEditingLineId(tempId);
  };

  const deleteLineItem = (id: number) => {
    handleDeleteOrderLineItem(id);
  };

  return (
    <div className="pt-4 pb-10" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>

      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">פריטי חיוב</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              addNewLineItem();
            }}
            disabled={!isEditing || editingLineId !== null}
            className="h-8"
          >
            <Plus className="h-4 w-4 ml-1" />
            הוסף פריט
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border-x border-t  rounded-md">
            <table className="w-full table-fixed rounded-md">
              <colgroup>
                <col style={{ width: '25%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '7%' }} />
              </colgroup>
              <thead>
                <tr className="border-b">
                  <th className="text-right p-2 text-sm font-medium">תיאור</th>
                  <th className="text-right p-2 text-sm font-medium">SKU</th>
                  <th className="text-right p-2 text-sm font-medium">מחיר</th>
                  <th className="text-right p-2 text-sm font-medium">כמות</th>
                  <th className="text-right p-2 text-sm font-medium">הנחה</th>
                  <th className="text-right p-2 text-sm font-medium">סיפק ע"י</th>
                  <th className="text-right p-2 text-sm font-medium">סופק</th>
                  <th className="text-right p-2 text-sm font-medium">סה"כ</th>
                  <th className="text-right p-2 text-sm font-medium">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {orderLineItems.map((item) => (
                  <tr key={item.id} className="border-b rounded-md">
                    <td className="p-2">
                      {editingLineId === item.id ? (
                        <Input
                          value={item.description || ''}
                          onChange={(e) => handleLineItemChange(item.id!, 'description', e.target.value)}
                          className="h-8 text-xs w-full"
                        />
                      ) : (
                        <span className="block w-full text-sm truncate">{item.description}</span>
                      )}
                    </td>
                    <td className="p-2">
                      {editingLineId === item.id ? (
                        <Input
                          value={item.sku || ''}
                          onChange={(e) => handleLineItemChange(item.id!, 'sku', e.target.value)}
                          className="h-8 text-xs w-full"
                        />
                      ) : (
                        <span className="block w-full text-sm truncate">{item.sku}</span>
                      )}
                    </td>
                    <td className="p-2">
                      {editingLineId === item.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={item.price || ''}
                          onChange={(e) => handleLineItemChange(item.id!, 'price', e.target.value)}
                          className="h-8 text-xs w-full"
                        />
                      ) : (
                        <span className="block w-full text-sm truncate">{item.price}</span>
                      )}
                    </td>
                    <td className="p-2">
                      {editingLineId === item.id ? (
                        <Input
                          type="number"
                          value={item.quantity || ''}
                          onChange={(e) => handleLineItemChange(item.id!, 'quantity', e.target.value)}
                          className="h-8 text-xs w-full"
                        />
                      ) : (
                        <span className="block w-full text-sm truncate">{item.quantity}</span>
                      )}
                    </td>
                    <td className="p-2">
                      {editingLineId === item.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={item.discount || ''}
                          onChange={(e) => handleLineItemChange(item.id!, 'discount', e.target.value)}
                          className="h-8 text-xs w-full"
                        />
                      ) : (
                        <span className="block w-full text-sm truncate">{item.discount}</span>
                      )}
                    </td>
                    <td className="p-2">
                      {editingLineId === item.id ? (
                        <Select
                          value={item.supplied_by || ''}
                          onValueChange={(value) => handleLineItemChange(item.id!, 'supplied_by', value)}
                        >
                          <SelectTrigger className="h-8 text-xs w-full">
                            <SelectValue placeholder="בחר" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="חנות" className="text-sm">חנות</SelectItem>
                            <SelectItem value="לקוח" className="text-sm">לקוח</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="block w-full text-sm truncate">{item.supplied_by}</span>
                      )}
                    </td>
                    <td className="p-2">
                      {editingLineId === item.id ? (
                        <Select
                          value={item.supplied ? 'true' : 'false'}
                          onValueChange={(value) => handleLineItemChange(item.id!, 'supplied', value)}
                        >
                          <SelectTrigger className="h-8 text-xs w-full">
                            <SelectValue placeholder="בחר" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true" className="text-sm">כן</SelectItem>
                            <SelectItem value="false" className="text-sm">לא</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="block w-full text-sm truncate">{item.supplied ? 'כן' : 'לא'}</span>
                      )}
                    </td>
                    <td className="p-2">
                      <span className="block w-full text-sm truncate">{item.line_total?.toFixed(2)}</span>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        {editingLineId === item.id ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingLineId(null)}
                              className="h-6 w-6 p-0"
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingLineId(null)}
                              className="h-6 w-6 p-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingLineId(item.id!)}
                              disabled={!isEditing}
                              className="h-6 w-6 p-0"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteLineItem(item.id!)}
                              disabled={!isEditing}
                              className="h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 md:grid-cols-3 gap-4 mt-4">
        <Card className="h-full col-span-1 py-5 shadow-md">
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
              <div>
                <Label className="text-sm">מספר תשלומים</Label>
                <Input
                  name="installment_count"
                  type="number"
                  value={billingFormData.installment_count || ''}
                  onChange={handleBillingInputChange}
                  disabled={!isEditing}
                  className="mt-1.5"
                  placeholder="1"
                />
              </div>
              <div>
                <Label className="text-sm">מקדמה</Label>
                <Input
                  name="prepayment_amount"
                  type="number"
                  step="0.01"
                  value={billingFormData.prepayment_amount || ''}
                  onChange={handleBillingInputChange}
                  disabled={!isEditing}
                  className="mt-1.5"
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label className="text-sm">סה"כ לפני הנחה</Label>
                <Input
                  name="total_before_discount"
                  type="number"
                  step="0.01"
                  value={billingFormData.total_before_discount || ''}
                  onChange={handleBillingInputChange}
                  disabled={!isEditing}
                  className="mt-1.5"
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label className="text-sm">הנחה (₪)</Label>
                <Input
                  name="discount_amount"
                  type="number"
                  step="0.01"
                  value={billingFormData.discount_amount || ''}
                  onChange={handleBillingInputChange}
                  disabled={!isEditing}
                  className="flex-1"
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label className="text-sm">הנחה (%)</Label>
                <Input
                  name="discount_percent"
                  type="number"
                  step="0.01"
                  value={billingFormData.discount_percent || ''}
                  onChange={handleBillingInputChange}
                  disabled={!isEditing}
                  className="flex-1"
                  placeholder="0%"
                />
              </div>

              <div>
                <Label className="text-sm">אחרי הנחה</Label>
                <Input
                  name="total_after_discount"
                  type="number"
                  step="0.01"
                  value={billingFormData.total_after_discount || ''}
                  onChange={handleBillingInputChange}
                  disabled={!isEditing}
                  className="mt-1.5"
                  placeholder="0.00"
                />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="h-full col-span-2">
          <NotesCard
            height="full"
            title="הערות"
            value={billingFormData.notes || ''}
            onChange={(value) => setBillingFormData(prev => ({ ...prev, notes: value }))}
            disabled={!isEditing}
            placeholder="הערות נוספות..."
          />
        </div>
      </div>
    </div>
  );
} 