import React, { useState, useEffect } from "react";
import { SiteHeader } from "@/components/site-header";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomModal } from "@/components/ui/custom-modal";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { getAllCampaigns, createCampaign, updateCampaign, deleteCampaign } from "@/lib/db/campaigns-db";
import { Campaign } from "@/lib/db/schema";
import { toast } from "sonner";
import { Trash2, Edit3, Plus, Filter, Mail, MessageSquare, Users, Calendar, X, ChevronDown, Play } from "lucide-react";

interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
  logic?: 'AND' | 'OR';
}

// Comprehensive field definitions with types and operators
const FILTER_FIELDS = {
  // Personal Info
  'first_name': { label: 'שם פרטי', type: 'text', category: 'מידע אישי' },
  'last_name': { label: 'שם משפחה', type: 'text', category: 'מידע אישי' },
  'gender': { label: 'מין', type: 'select', options: ['זכר', 'נקבה'], category: 'מידע אישי' },
  'age': { label: 'גיל', type: 'number', category: 'מידע אישי' },
  'date_of_birth': { label: 'תאריך לידה', type: 'date', category: 'מידע אישי' },
  'national_id': { label: 'תעודת זהות', type: 'text', category: 'מידע אישי' },
  'health_fund': { label: 'קופת חולים', type: 'select', options: ['כללית', 'מכבי', 'לאומית', 'מאוחדת'], category: 'מידע אישי' },
  
  // Contact Info
  'phone_mobile': { label: 'טלפון נייד', type: 'text', category: 'פרטי התקשרות' },
  'email': { label: 'דואר אלקטרוני', type: 'text', category: 'פרטי התקשרות' },
  'address_city': { label: 'עיר', type: 'text', category: 'פרטי התקשרות' },
  
  // Family
  'has_family': { label: 'יש משפחה', type: 'boolean', category: 'משפחה' },
  'family_role': { label: 'תפקיד במשפחה', type: 'select', options: ['אב', 'אם', 'בן', 'בת', 'אח', 'אחות'], category: 'משפחה' },
  
  // Status & Financial
  'status': { label: 'סטטוס', type: 'select', options: ['פעיל', 'לא פעיל', 'חסום'], category: 'סטטוס' },
  'blocked_checks': { label: 'חסום לצ\'קים', type: 'boolean', category: 'סטטוס' },
  'blocked_credit': { label: 'חסום לאשראי', type: 'boolean', category: 'סטטוס' },
  'discount_percent': { label: 'אחוז הנחה', type: 'number', category: 'סטטוס' },
  
  // Dates
  'file_creation_date': { label: 'תאריך יצירת תיק', type: 'date', category: 'תאריכים' },
  'membership_end': { label: 'תאריך סיום חברות', type: 'date', category: 'תאריכים' },
  'service_end': { label: 'תאריך סיום שירות', type: 'date', category: 'תאריכים' },
  
  // Activity
  'last_exam_days': { label: 'ימים מאז בדיקה אחרונה', type: 'number', category: 'פעילות' },
  'last_order_days': { label: 'ימים מאז הזמנה אחרונה', type: 'number', category: 'פעילות' },
  'last_appointment_days': { label: 'ימים מאז תור אחרון', type: 'number', category: 'פעילות' },
  'has_appointments': { label: 'יש תורים', type: 'boolean', category: 'פעילות' },
  'has_exams': { label: 'יש בדיקות', type: 'boolean', category: 'פעילות' },
  'has_orders': { label: 'יש הזמנות', type: 'boolean', category: 'פעילות' },
  'total_orders': { label: 'סך הזמנות', type: 'number', category: 'פעילות' },
  'total_exams': { label: 'סך בדיקות', type: 'number', category: 'פעילות' },
} as const;

const OPERATORS = {
  text: [
    { value: 'contains', label: 'מכיל' },
    { value: 'not_contains', label: 'לא מכיל' },
    { value: 'equals', label: 'שווה ל' },
    { value: 'not_equals', label: 'לא שווה ל' },
    { value: 'starts_with', label: 'מתחיל ב' },
    { value: 'ends_with', label: 'מסתיים ב' },
    { value: 'is_empty', label: 'ריק' },
    { value: 'is_not_empty', label: 'לא ריק' },
  ],
  number: [
    { value: 'equals', label: 'שווה ל' },
    { value: 'not_equals', label: 'לא שווה ל' },
    { value: 'greater_than', label: 'גדול מ' },
    { value: 'less_than', label: 'קטן מ' },
    { value: 'greater_equal', label: 'גדול או שווה ל' },
    { value: 'less_equal', label: 'קטן או שווה ל' },
    { value: 'is_empty', label: 'ריק' },
    { value: 'is_not_empty', label: 'לא ריק' },
  ],
  date: [
    { value: 'equals', label: 'שווה ל' },
    { value: 'not_equals', label: 'לא שווה ל' },
    { value: 'after', label: 'אחרי' },
    { value: 'before', label: 'לפני' },
    { value: 'last_days', label: 'ב X ימים האחרונים' },
    { value: 'next_days', label: 'ב X ימים הבאים' },
    { value: 'is_empty', label: 'ריק' },
    { value: 'is_not_empty', label: 'לא ריק' },
  ],
  boolean: [
    { value: 'equals', label: 'שווה ל' },
    { value: 'not_equals', label: 'לא שווה ל' },
  ],
  select: [
    { value: 'equals', label: 'שווה ל' },
    { value: 'not_equals', label: 'לא שווה ל' },
  ],
};

function FilterBuilder({ filters, onChange }: { filters: FilterCondition[], onChange: (filters: FilterCondition[]) => void }) {
  const addFilter = () => {
    const newFilter: FilterCondition = {
      id: Date.now().toString(),
      field: '',
      operator: '',
      value: '',
      logic: filters.length > 0 ? 'AND' : undefined,
    };
    onChange([...filters, newFilter]);
  };

  const removeFilter = (id: string) => {
    onChange(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<FilterCondition>) => {
    onChange(filters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const getOperators = (fieldType: string) => {
    return OPERATORS[fieldType as keyof typeof OPERATORS] || OPERATORS.text;
  };

  const renderValueInput = (filter: FilterCondition) => {
    const field = FILTER_FIELDS[filter.field as keyof typeof FILTER_FIELDS];
    if (!field) return null;

    const needsNoValue = ['is_empty', 'is_not_empty'].includes(filter.operator);
    if (needsNoValue) return null;

    if (field.type === 'boolean') {
      return (
        <Select value={filter.value} onValueChange={(value) => updateFilter(filter.id, { value })}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="ערך" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">כן</SelectItem>
            <SelectItem value="false">לא</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    if (field.type === 'select' && 'options' in field) {
      return (
        <Select value={filter.value} onValueChange={(value) => updateFilter(filter.id, { value })}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="ערך" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option: string) => (
              <SelectItem key={option} value={option}>{option}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.type === 'date') {
      // For last_days/next_days operators, show number input instead of date
      if (['last_days', 'next_days'].includes(filter.operator)) {
        return (
          <Input
            type="number"
            value={filter.value}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            placeholder="מספר ימים"
            className="w-32"
          />
        );
      }
      return (
        <Input
          type="date"
          value={filter.value}
          onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
          className="w-40"
        />
      );
    }

    return (
      <Input
        type={field.type === 'number' ? 'number' : 'text'}
        value={filter.value}
        onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
        placeholder="ערך"
        className="w-40"
      />
    );
  };

  // Group fields by category
  const fieldsByCategory = Object.entries(FILTER_FIELDS).reduce((acc, [key, field]) => {
    if (!acc[field.category]) acc[field.category] = [];
    acc[field.category].push({ key, ...field });
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-3">
      {filters.map((filter, index) => (
        <div key={filter.id} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
          {index > 0 && (
            <Select value={filter.logic} onValueChange={(value) => updateFilter(filter.id, { logic: value as 'AND' | 'OR' })}>
              <SelectTrigger className="w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">וגם</SelectItem>
                <SelectItem value="OR">או</SelectItem>
              </SelectContent>
            </Select>
          )}
          
          <Select value={filter.field} onValueChange={(value) => updateFilter(filter.id, { field: value, operator: '', value: '' })}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="בחר שדה" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(fieldsByCategory).map(([category, fields]) => (
                <div key={category}>
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground bg-muted sticky top-0 z-10">
                    {category}
                  </div>
                  {fields.map(field => (
                    <SelectItem key={field.key} value={field.key}>{field.label}</SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>

          {filter.field && (
            <Select value={filter.operator} onValueChange={(value) => updateFilter(filter.id, { operator: value, value: '' })}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="אופרטור" />
              </SelectTrigger>
              <SelectContent>
                {getOperators(FILTER_FIELDS[filter.field as keyof typeof FILTER_FIELDS]?.type || 'text').map(op => (
                  <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {filter.field && filter.operator && renderValueInput(filter)}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeFilter(filter.id)}
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      
      <Button variant="outline" onClick={addFilter} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        הוספת תנאי
      </Button>
    </div>
  );
}

function CampaignModal({ isOpen, onClose, campaign, onSave }: {
  isOpen: boolean;
  onClose: () => void;
  campaign?: Campaign;
  onSave: (data: Campaign) => void
}) {
  const [name, setName] = useState(campaign?.name || '');
  const [filters, setFilters] = useState<FilterCondition[]>(
    campaign ? JSON.parse(campaign.filters || '[]') : []
  );
  const [emailEnabled, setEmailEnabled] = useState(campaign?.email_enabled || false);
  const [emailContent, setEmailContent] = useState(campaign?.email_content || '');
  const [smsEnabled, setSmsEnabled] = useState(campaign?.sms_enabled || false);
  const [smsContent, setSmsContent] = useState(campaign?.sms_content || '');
  const [cycleType, setCycleType] = useState<'daily' | 'monthly' | 'yearly' | 'custom'>(campaign?.cycle_type || 'daily');
  const [customDays, setCustomDays] = useState(campaign?.cycle_custom_days || 1);

  const handleConfirm = () => {
    const data = {
      id: campaign?.id,
      name,
      filters: JSON.stringify(filters),
      email_enabled: emailEnabled,
      email_content: emailContent,
      sms_enabled: smsEnabled,
      sms_content: smsContent,
      active: campaign?.active || false,
      active_since: campaign?.active_since,
      mail_sent: campaign?.mail_sent || false,
      sms_sent: campaign?.sms_sent || false,
      emails_sent_count: campaign?.emails_sent_count || 0,
      sms_sent_count: campaign?.sms_sent_count || 0,
      cycle_type: cycleType,
      cycle_custom_days: cycleType === 'custom' ? customDays : undefined,
      last_executed: campaign?.last_executed,
    };
    onSave(data as Campaign);
  };

  const reset = () => {
    setName(campaign?.name || '');
    setFilters(campaign ? JSON.parse(campaign.filters || '[]') : []);
    setEmailEnabled(campaign?.email_enabled || false);
    setEmailContent(campaign?.email_content || '');
    setSmsEnabled(campaign?.sms_enabled || false);
    setSmsContent(campaign?.sms_content || '');
    setCycleType(campaign?.cycle_type || 'daily');
    setCustomDays(campaign?.cycle_custom_days || 1);
  };

  useEffect(() => {
    if (isOpen) reset();
  }, [isOpen, campaign]);

  return (
    <CustomModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={campaign ? "עריכת קמפיין" : "קמפיין חדש"} 
      onConfirm={handleConfirm} 
      confirmText="שמירה" 
      cancelText="ביטול"
      width="max-w-4xl"
    >
      <div className="space-y-6" dir="rtl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">שם הקמפיין</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="הכנס שם לקמפיין"
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center">
              <Calendar className="h-4 w-4 ml-2" />
              תדירות ביצוע
            </Label>
            <div className="space-y-2">
              <Select value={cycleType} onValueChange={(value: 'daily' | 'monthly' | 'yearly' | 'custom') => setCycleType(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="בחר תדירות ביצוע" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">כל יום</SelectItem>
                  <SelectItem value="monthly">כל חודש</SelectItem>
                  <SelectItem value="yearly">כל שנה</SelectItem>
                  <SelectItem value="custom">מספר ימים מותאם אישית</SelectItem>
                </SelectContent>
              </Select>
              
              {cycleType === 'custom' && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={customDays}
                    onChange={(e) => setCustomDays(parseInt(e.target.value) || 1)}
                    placeholder="מספר ימים"
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">ימים</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {cycleType && (
          <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded-md">
            <strong>הסבר:</strong> הקמפיין יבוצע אוטומטית לפי התדירות שנבחרה.
            {cycleType === 'daily' && ' הקמפיין יבוצע כל יום בשעה 10:00.'}
            {cycleType === 'monthly' && ' הקמפיין יבוצע פעם בחודש באותו תאריך.'}
            {cycleType === 'yearly' && ' הקמפיין יבוצע פעם בשנה באותו תאריך.'}
            {cycleType === 'custom' && ` הקמפיין יבוצע כל ${customDays} ימים.`}
          </div>
        )}

        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center">
            <Filter className="h-4 w-4" />
            מסננים
          </Label>
          <div className="border rounded-lg p-4 bg-background">
            <FilterBuilder filters={filters} onChange={setFilters} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="email" 
                checked={emailEnabled} 
                onCheckedChange={(checked) => { 
                  if (checked !== 'indeterminate') setEmailEnabled(checked); 
                }} 
              />
              <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                שליחת אימייל
              </Label>
            </div>
            {emailEnabled && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">תוכן האימייל</Label>
                <Textarea 
                  value={emailContent} 
                  onChange={(e) => setEmailContent(e.target.value)}
                  rows={6}
                  placeholder="הכנס את תוכן האימייל כאן..."
                  className="w-full"
                />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="sms" 
                checked={smsEnabled} 
                onCheckedChange={(checked) => { 
                  if (checked !== 'indeterminate') setSmsEnabled(checked); 
                }} 
              />
              <Label htmlFor="sms" className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                שליחת SMS
              </Label>
            </div>
            {smsEnabled && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">תוכן ה-SMS</Label>
                <Textarea 
                  value={smsContent} 
                  onChange={(e) => setSmsContent(e.target.value)}
                  rows={4}
                  placeholder="הכנס את תוכן ה-SMS כאן..."
                  className="w-full"
                  maxLength={160}
                />
                <div className="text-xs text-muted-foreground text-left">
                  {smsContent.length}/160 תווים
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </CustomModal>
  );
}

export default function CampaignsPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | undefined>(undefined);
  const [runningCampaignId, setRunningCampaignId] = useState<number | null>(null);
  const [emailSettingsConfigured, setEmailSettingsConfigured] = useState<boolean>(true);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      console.log('Loading campaigns...');
      const data = await getAllCampaigns();
      console.log('Loaded campaigns:', data);
      
      // Check if campaigns have the new fields
      if (data.length > 0) {
        const firstCampaign = data[0];
        console.log('First campaign structure:', Object.keys(firstCampaign));
        if (firstCampaign.active === undefined) {
          console.warn('⚠️ Database schema is outdated - missing new fields. Please delete database file and restart.');
          toast.error("בעיה במבנה הנתונים - יש צורך לאפס את בסיס הנתונים");
        }
      }
      
      setCampaigns(data);
      
      // Check email settings configuration
      const emailConfigured = await checkEmailSettingsConfigured();
      setEmailSettingsConfigured(emailConfigured);
    } catch (error) {
      console.error('Error loading campaigns:', error);
      toast.error("שגיאה בטעינת הקמפיינים");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    const handleOpenCampaignModal = (event: CustomEvent) => {
      const { campaignId } = event.detail;
      const campaign = campaigns.find(c => c.id === campaignId);
      if (campaign) {
        openModal(campaign);
      }
    };

    window.addEventListener('openCampaignModal', handleOpenCampaignModal as EventListener);
    
    return () => {
      window.removeEventListener('openCampaignModal', handleOpenCampaignModal as EventListener);
    };
  }, [campaigns]);

  const handleToggleActive = async (campaign: Campaign) => {
    // Optimistic update - update UI immediately
    const optimisticCampaigns = campaigns.map(c => 
      c.id === campaign.id 
        ? { 
            ...c, 
            active: !c.active, 
            active_since: !c.active ? new Date().toISOString() : c.active_since 
          }
        : c
    );
    setCampaigns(optimisticCampaigns);

    try {
      console.log('Toggling campaign:', campaign.id, 'from', campaign.active, 'to', !campaign.active);
      const updatedCampaign = {
        ...campaign,
        active: !campaign.active,
        active_since: !campaign.active ? new Date().toISOString() : campaign.active_since
      };
      console.log('Updated campaign data:', updatedCampaign);
      
      const result = await updateCampaign(updatedCampaign);
      console.log('Update result:', result);
      
      if (!result) {
        throw new Error('Failed to update campaign');
      }
      
      toast.success(updatedCampaign.active ? "קמפיין הופעל" : "קמפיין הושבת");
    } catch (error) {
      console.error('Error toggling campaign:', error);
      // Revert optimistic update on error
      setCampaigns(campaigns);
      toast.error("שגיאה בעדכון סטטוס הקמפיין");
    }
  };

  const handleSave = async (data: Campaign) => {
    try {
      if (data.id) {
        const result = await updateCampaign(data);
        if (result) {
          // Optimistic update for edit
          setCampaigns(campaigns.map(c => c.id === data.id ? result : c));
          toast.success("קמפיין עודכן בהצלחה");
        } else {
          throw new Error('Failed to update campaign');
        }
      } else {
        const result = await createCampaign(data);
        if (result) {
          // Optimistic update for create
          setCampaigns([result, ...campaigns]);
          toast.success("קמפיין נוצר בהצלחה");
        } else {
          throw new Error('Failed to create campaign');
        }
      }
      setIsModalOpen(false);
      setEditingCampaign(undefined);
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast.error("שגיאה בשמירת הקמפיין");
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("האם אתה בטוח שברצונך למחוק קמפיין זה?")) {
      // Optimistic update - remove immediately
      const originalCampaigns = campaigns;
      setCampaigns(campaigns.filter(c => c.id !== id));
      
      try {
        const result = await deleteCampaign(id);
        if (!result) {
          throw new Error('Failed to delete campaign');
        }
        toast.success("קמפיין נמחק בהצלחה");
      } catch (error) {
        console.error('Error deleting campaign:', error);
        // Revert optimistic update on error
        setCampaigns(originalCampaigns);
        toast.error("שגיאה במחיקת הקמפיין");
      }
    }
  };

  const handleRunCampaign = async (campaign: Campaign) => {
    if (!campaign.id || runningCampaignId) return;
    
    const confirmed = confirm(`האם אתה בטוח שברצונך להריץ את הקמפיין "${campaign.name}" עכשיו? זה ישלח הודעות לכל הלקוחות המסוננים.`);
    if (!confirmed) return;
    
    setRunningCampaignId(campaign.id);
    const loadingToast = toast.loading("מריץ קמפיין...");
    
    try {
      const result = await window.electronAPI.campaignExecuteFull(campaign.id);
      
      console.log('Campaign execution result:', result);
      
      if (result.success) {
        toast.success(`קמפיין הורץ בהצלחה: ${result.message}`, {
          id: loadingToast,
        });
        
        // Update the campaign status with new counts
        const updatedCampaign = {
          ...campaign,
          mail_sent: campaign.email_enabled && result.details?.emailsSent > 0,
          sms_sent: campaign.sms_enabled && result.details?.smsSent > 0,
          emails_sent_count: (campaign.emails_sent_count || 0) + (result.details?.emailsSent || 0),
          sms_sent_count: (campaign.sms_sent_count || 0) + (result.details?.smsSent || 0),
        };
        
        setCampaigns(campaigns.map(c => 
          c.id === campaign.id ? updatedCampaign : c
        ));
      } else {
        let errorMessage = result.message;
        if (result.details && Array.isArray(result.details)) {
          errorMessage += `: ${result.details.join(', ')}`;
        }
        const onlyNoClients = result.details && Array.isArray(result.details) && result.details.length === 1 && (
          result.details[0].includes('No target clients have phone numbers') ||
          result.details[0].includes('No target clients have email addresses') ||
          result.details[0].includes('No target clients found matching the filters')
        );
        
        const emailSettingsNotConfigured = 
          (result.details && Array.isArray(result.details) && 
            result.details.some(detail => detail.includes('Email settings not configured'))) ||
          (result.message && result.message.includes('Email settings not configured')) ||
          (result.details && Array.isArray(result.details) && 
            result.details.some(detail => detail.includes('Email settings not found'))) ||
          (result.message && result.message.includes('Email settings not found'));
        
        if (emailSettingsNotConfigured) {
          toast.error('הגדרות האימייל לא מוגדרות. יש להגדיר הגדרות אימייל בעמוד ההגדרות.', {
            id: loadingToast,
            action: {
              label: 'פתח הגדרות',
              onClick: () => {
                navigate({ to: '/settings' });
              }
            }
          });
        } else if (campaign.email_enabled && result.details?.emailsSent === 0 && result.details?.targetClients > 0) {
          // Campaign was supposed to send emails but none were sent, likely due to email settings
          toast.error('הגדרות האימייל לא מוגדרות או שגויות. יש להגדיר הגדרות אימייל בעמוד ההגדרות.', {
            id: loadingToast,
            action: {
              label: 'פתח הגדרות',
              onClick: () => {
                navigate({ to: '/settings' });
              }
            }
          });
        } else if (onlyNoClients) {
          toast.info('אין לקוחות מתאימים לשליחת הודעות בקמפיין זה.', {
            id: loadingToast,
          });
        } else {
          toast.error(`שגיאה בהרצת הקמפיין: ${errorMessage}`, {
            id: loadingToast,
          });
        }
      }
    } catch (error) {
      console.error('Error running campaign:', error);
      toast.error("שגיאה בהרצת הקמפיין", {
        id: loadingToast,
      });
    } finally {
      setRunningCampaignId(null);
    }
  };

  const openModal = (campaign?: Campaign) => {
    setEditingCampaign(campaign);
    setIsModalOpen(true);
  };

  const getFilterCount = (campaign: Campaign) => {
    try {
      const filters = JSON.parse(campaign.filters || '[]');
      return filters.length;
    } catch {
      return 0;
    }
  };

  const checkEmailSettingsConfigured = async () => {
    try {
      const settings = await window.electronAPI.db('getSettings');
      return settings && settings.email_username && settings.email_password;
    } catch {
      return false;
    }
  };

  if (loading) {
    return (
      <>
        <SiteHeader title="קמפיינים" />
        <div className="flex items-center justify-center h-full">
          <div className="text-lg">טוען קמפיינים...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader title="קמפיינים" />
      <div className="h-full overflow-auto bg-muted/30" style={{scrollbarWidth: 'none'}} dir="rtl">
        <div className="max-w-7xl mx-auto p-6 pb-20 space-y-6">
          {!emailSettingsConfigured && campaigns.some(c => c.email_enabled) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-amber-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="text-right">
                    <h3 className="text-sm font-medium text-amber-800">הגדרות אימייל לא מוגדרות</h3>
                    <p className="text-xs text-amber-700 mt-1">
                      יש קמפיינים עם אימייל מופעל אך הגדרות האימייל לא מוגדרות. יש להגדיר הגדרות אימייל בעמוד ההגדרות.
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate({ to: '/settings' })}
                  className="text-amber-700 border-amber-300 hover:bg-amber-100"
                >
                  פתח הגדרות
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">קמפיינים</h1>
              <p className="text-muted-foreground">נהל קמפיינים שיווקיים ושליחת הודעות ללקוחות</p>
            </div>
            <Button onClick={() => openModal()} size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              קמפיין חדש
            </Button>
          </div>

          {campaigns.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">אין קמפיינים</h3>
                <p className="text-muted-foreground text-center mb-4">
                  צור קמפיין ראשון כדי להתחיל לשלוח הודעות ללקוחות
                </p>
                <Button onClick={() => openModal()}>
                  <Plus className="h-4 w-4 mr-2" />
                  צור קמפיין ראשון
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {campaigns.map(campaign => (
                <Card key={campaign.id} data-campaign-id={campaign.id} className="group hover:shadow-lg transition-all duration-300 border-0 shadow-sm bg-gradient-to-br from-white to-gray-50/50">
                  <CardContent className="px-4">
                    {/* Header with Title and Actions */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate pr-2">
                          {campaign.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {new Date(campaign.created_at || '').toLocaleDateString('he-IL')}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRunCampaign(campaign)}
                            className="h-6 w-6 p-0 hover:bg-green-50 hover:text-green-600"
                            disabled={!campaign.active || (!campaign.email_enabled && !campaign.sms_enabled) || runningCampaignId !== null}
                            title={runningCampaignId === campaign.id ? "קמפיין רץ..." : "הרץ קמפיין עכשיו"}
                          >
                            <Play className={`h-3 w-3 ${runningCampaignId === campaign.id ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openModal(campaign)}
                            className="h-6 w-6 p-0 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(campaign.id!)}
                            className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Status Toggle */}
                    <div className="flex items-center justify-between mb-3 p-2 rounded-lg bg-gray-50/50">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${campaign.active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <span className="text-xs font-medium text-gray-600">
                          {campaign.active ? 'פעיל' : 'לא פעיל'}
                        </span>
                        {campaign.active && campaign.active_since && (
                          <span className="text-xs text-gray-400">
                            מאז {new Date(campaign.active_since).toLocaleDateString('he-IL')}
                          </span>
                        )}
                      </div>
                      <Switch dir="ltr"
                        checked={campaign.active}
                        onCheckedChange={() => handleToggleActive(campaign)}
                        className="scale-75"
                      />
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="text-center p-2 rounded-md bg-blue-50/50">
                        <div className="text-xs font-semibold text-blue-600">
                          {getFilterCount(campaign)}
                        </div>
                        <div className="text-xs text-blue-500">מסננים</div>
                      </div>
                      
                      <div 
                        className={`text-center p-2 rounded-md ${
                          campaign.email_enabled 
                            ? (emailSettingsConfigured ? 'bg-green-50/50' : 'bg-amber-50/50') 
                            : 'bg-gray-50/50'
                        }`}
                        title={campaign.email_enabled && !emailSettingsConfigured 
                          ? 'הגדרות האימייל לא מוגדרות. יש להגדיר הגדרות אימייל בעמוד ההגדרות.' 
                          : undefined
                        }
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Mail className={`h-3 w-3 ${
                            campaign.email_enabled 
                              ? (emailSettingsConfigured ? 'text-green-600' : 'text-amber-600') 
                              : 'text-gray-400'
                          }`} />
                          <span className={`text-xs font-semibold ${
                            campaign.email_enabled 
                              ? (emailSettingsConfigured ? 'text-green-600' : 'text-amber-600') 
                              : 'text-gray-400'
                          }`}>
                            {campaign.emails_sent_count || 0}
                          </span>
                        </div>
                        <div className={`text-xs ${
                          campaign.email_enabled 
                            ? (emailSettingsConfigured ? 'text-green-500' : 'text-amber-500') 
                            : 'text-gray-400'
                        }`}>
                          {campaign.email_enabled && !emailSettingsConfigured ? 'אימייל ⚠️' : 'אימייל'}
                        </div>
                      </div>
                      
                      <div className="text-center p-2 rounded-md bg-purple-50/50">
                        <div className="flex items-center justify-center gap-1">
                          <MessageSquare className={`h-3 w-3 ${campaign.sms_enabled ? 'text-purple-600' : 'text-gray-400'}`} />
                          <span className={`text-xs font-semibold ${campaign.sms_enabled ? 'text-purple-600' : 'text-gray-400'}`}>
                            {campaign.sms_sent_count || 0}
                          </span>
                        </div>
                        <div className="text-xs text-purple-500">SMS</div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="w-full">
                      {campaign.active ? (
                        (campaign.email_enabled || campaign.sms_enabled) ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full h-8 bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 border-blue-200 text-blue-700 hover:text-blue-800 text-xs font-medium"
                          >
                            <Users className="h-3 w-3 mr-1" />
                             קמפיין פעיל
                          </Button>
                        ) : (
                          <div className="w-full h-8 flex items-center justify-center text-xs text-amber-600 bg-amber-50 rounded-md border border-amber-200">
                            יש להפעיל אימייל או SMS
                          </div>
                        )
                      ) : (
                        <div className="w-full h-8 flex items-center justify-center text-xs text-gray-400 bg-gray-50 rounded-md">
                          הפעל כדי להריץ קמפיין
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <CampaignModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        campaign={editingCampaign} 
        onSave={handleSave} 
      />
    </>
  );
} 