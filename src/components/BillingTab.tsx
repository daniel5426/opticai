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
  const [newLineItem, setNewLineItem] = useState<Partial<OrderLineItem>>({});
  const [isAddingNewLine, setIsAddingNewLine] = useState(false);

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

  const handleLineItemChange = (id: number | 'new', field: keyof OrderLineItem, value: string) => {
    if (id === 'new') {
      setNewLineItem(prev => {
        const newItem = { ...prev };
        const numericFields = ['price', 'quantity', 'discount'];
        if (numericFields.includes(field)) {
          const numValue = parseFloat(value);
          (newItem as any)[field] = value === '' || isNaN(numValue) ? undefined : numValue;
        } else if (field === 'supplied') {
          (newItem as any)[field] = value === 'true';
        } else {
          (newItem as any)[field] = value;
        }
        
        if (field === 'price' || field === 'quantity' || field === 'discount') {
          const price = newItem.price || 0;
          const quantity = newItem.quantity || 0;
          const discount = newItem.discount || 0;
          newItem.line_total = (price * quantity) - discount;
        }
        
        return newItem;
      });
    } else {
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
    }
  };

  const addNewLineItem = () => {
    console.log("addNewLineItem called with:", newLineItem);
    console.log("Current orderLineItems:", orderLineItems);
    console.log("Description check:", newLineItem.description, newLineItem.description?.trim());
    
    if (newLineItem.description && newLineItem.description.trim() !== '') {
      const tempId = -(Math.max(0, ...orderLineItems.map(item => Math.abs(item.id || 0))) + 1);
      const itemToAdd: OrderLineItem = {
        id: tempId,
        billings_id: billingFormData.id || 0,
        description: newLineItem.description,
        sku: newLineItem.sku || '',
        price: newLineItem.price || 0,
        quantity: newLineItem.quantity || 1,
        discount: newLineItem.discount || 0,
        supplied_by: newLineItem.supplied_by || '',
        supplied: newLineItem.supplied || false,
        line_total: newLineItem.line_total || 0
      };
      console.log("Adding new line item:", itemToAdd);
      setOrderLineItems(prev => {
        const newItems = [...prev, itemToAdd];
        console.log("New orderLineItems array:", newItems);
        return newItems;
      });
      setNewLineItem({});
      setIsAddingNewLine(false);
    } else {
      console.warn("Cannot add line item: description is missing or empty");
    }
  };

  const deleteLineItem = (id: number) => {
    handleDeleteOrderLineItem(id);
  };

  return (
    <div className="pt-4 pb-10" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>

      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">פריטי חיוב</CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              console.log("Plus button clicked, isEditing:", isEditing, "isAddingNewLine:", isAddingNewLine);
              setIsAddingNewLine(true);
            }}
            disabled={!isEditing || isAddingNewLine}
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
                {isAddingNewLine && (
                  <tr className="border-b rounded-md bg-gray-50">
                    <td className="p-2">
                      <Input
                        value={newLineItem.description || ''}
                        onChange={(e) => handleLineItemChange('new', 'description', e.target.value)}
                        placeholder="תיאור"
                        className="h-8 text-xs w-full"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        value={newLineItem.sku || ''}
                        onChange={(e) => handleLineItemChange('new', 'sku', e.target.value)}
                        placeholder="SKU"
                        className="h-8 text-xs w-full"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={newLineItem.price || ''}
                        onChange={(e) => handleLineItemChange('new', 'price', e.target.value)}
                        placeholder="0.00"
                        className="h-8 text-xs w-full"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        value={newLineItem.quantity || ''}
                        onChange={(e) => handleLineItemChange('new', 'quantity', e.target.value)}
                        placeholder="1"
                        className="h-8 text-xs w-full"
                      />
                    </td>
                    <td className="p-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={newLineItem.discount || ''}
                        onChange={(e) => handleLineItemChange('new', 'discount', e.target.value)}
                        placeholder="0.00"
                        className="h-8 text-xs w-full"
                      />
                    </td>
                    <td className="p-2">
                      <Select
                        value={newLineItem.supplied_by || ''}
                        onValueChange={(value) => handleLineItemChange('new', 'supplied_by', value)}
                      >
                        <SelectTrigger className="h-8 text-xs w-full">
                          <SelectValue placeholder="בחר" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="חנות" className="text-sm">חנות</SelectItem>
                          <SelectItem value="לקוח" className="text-sm">לקוח</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <Select
                        value={newLineItem.supplied ? 'true' : 'false'}
                        onValueChange={(value) => handleLineItemChange('new', 'supplied', value)}
                      >
                        <SelectTrigger className="h-8 text-xs w-full">
                          <SelectValue placeholder="בחר" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true" className="text-sm">כן</SelectItem>
                          <SelectItem value="false" className="text-sm">לא</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      <span className="block w-full text-sm truncate">{newLineItem.line_total?.toFixed(2) || '0.00'}</span>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={addNewLineItem}
                          className="h-6 w-6 p-0"
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsAddingNewLine(false);
                            setNewLineItem({});
                          }}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
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