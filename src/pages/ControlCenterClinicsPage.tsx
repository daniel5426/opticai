import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRouter } from '@tanstack/react-router';
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  User,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import type { Company, Clinic } from '@/lib/db/schema';

const ControlCenterClinicsPage: React.FC = () => {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [filteredClinics, setFilteredClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<Clinic | null>(null);

  const [newClinic, setNewClinic] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    manager_name: '',
    license_number: '',
    is_active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterClinics();
  }, [clinics, searchTerm]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Get company data from session storage
      const companyData = sessionStorage.getItem('controlCenterCompany');
      if (!companyData) {
        router.navigate({ to: '/control-center' });
        return;
      }
      
      const parsedCompany = JSON.parse(companyData) as Company;
      setCompany(parsedCompany);

      // Load clinics for this company
      const clinicsResult = await window.electronAPI.db('getClinicsByCompanyId', parsedCompany.id);
      setClinics(clinicsResult || []);
    } catch (error) {
      console.error('Error loading clinics data:', error);
      toast.error('שגיאה בטעינת נתוני המרפאות');
    } finally {
      setLoading(false);
    }
  };

  const filterClinics = () => {
    let filtered = clinics;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(clinic => 
        clinic.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clinic.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clinic.manager_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredClinics(filtered);
  };

  const handleAddClinic = async () => {
    try {
      if (!newClinic.name.trim()) {
        toast.error('שם המרפאה הוא שדה חובה');
        return;
      }

      if (!company) {
        toast.error('לא נמצאו נתוני החברה');
        return;
      }

      const clinicData = {
        company_id: company.id,
        ...newClinic
      };

      const createdClinic = await window.electronAPI.db('createClinic', clinicData);
      
      if (createdClinic) {
        toast.success('המרפאה נוספה בהצלחה');
        setIsAddDialogOpen(false);
        setNewClinic({
          name: '',
          address: '',
          phone: '',
          email: '',
          manager_name: '',
          license_number: '',
          is_active: true
        });
        loadData();
      } else {
        toast.error('שגיאה ביצירת המרפאה');
      }
    } catch (error) {
      console.error('Error creating clinic:', error);
      toast.error('שגיאה ביצירת המרפאה');
    }
  };

  const handleEditClinic = async () => {
    try {
      if (!editingClinic) return;

      const updatedClinic = await window.electronAPI.db('updateClinic', editingClinic);
      
      if (updatedClinic) {
        toast.success('המרפאה עודכנה בהצלחה');
        setIsEditDialogOpen(false);
        setEditingClinic(null);
        loadData();
      } else {
        toast.error('שגיאה בעדכון המרפאה');
      }
    } catch (error) {
      console.error('Error updating clinic:', error);
      toast.error('שגיאה בעדכון המרפאה');
    }
  };

  const handleDeleteClinic = async (clinicId: number) => {
    try {
      const confirmed = window.confirm('האם אתה בטוח שברצונך למחוק את המרפאה? פעולה זו תשבית את המרפאה ולא תמחק אותה לחלוטין.');
      if (!confirmed) return;

      const success = await window.electronAPI.db('deleteClinic', clinicId);
      
      if (success) {
        toast.success('המרפאה הושבתה בהצלחה');
        loadData();
      } else {
        toast.error('שגיאה בהשבתת המרפאה');
      }
    } catch (error) {
      console.error('Error deleting clinic:', error);
      toast.error('שגיאה בהשבתת המרפאה');
    }
  };

  const handleToggleClinicStatus = async (clinic: Clinic) => {
    try {
      const updatedClinic = {
        ...clinic,
        is_active: !clinic.is_active
      };

      const result = await window.electronAPI.db('updateClinic', updatedClinic);
      
      if (result) {
        toast.success(`המרפאה ${clinic.is_active ? 'הושבתה' : 'הופעלה'} בהצלחה`);
        loadData();
      } else {
        toast.error('שגיאה בעדכון סטטוס המרפאה');
      }
    } catch (error) {
      console.error('Error toggling clinic status:', error);
      toast.error('שגיאה בעדכון סטטוס המרפאה');
    }
  };

  const handleViewClinicSettings = (clinicId: number) => {
    // Navigate to clinic-specific settings page
    router.navigate({ to: `/control-center/clinics/${clinicId}/settings` });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען נתוני מרפאות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100" dir="rtl">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => router.navigate({ to: '/control-center/dashboard' })}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                חזור ללוח הבקרה
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  ניהול מרפאות - {company?.name}
                </h1>
                <p className="text-gray-600">
                  ניהול כל המרפאות בחברה
                </p>
              </div>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 ml-2" />
                  הוסף מרפאה
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>הוסף מרפאה חדשה</DialogTitle>
                  <DialogDescription>
                    הזן את פרטי המרפאה החדשה
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">שם המרפאה *</Label>
                    <Input
                      id="name"
                      value={newClinic.name}
                      onChange={(e) => setNewClinic(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="הזן שם המרפאה"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">כתובת</Label>
                    <Textarea
                      id="address"
                      value={newClinic.address}
                      onChange={(e) => setNewClinic(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="הזן כתובת המרפאה"
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">טלפון</Label>
                    <Input
                      id="phone"
                      value={newClinic.phone}
                      onChange={(e) => setNewClinic(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="הזן מספר טלפון"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">אימייל</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newClinic.email}
                      onChange={(e) => setNewClinic(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="הזן כתובת אימייל"
                    />
                  </div>
                  <div>
                    <Label htmlFor="manager">שם המנהל</Label>
                    <Input
                      id="manager"
                      value={newClinic.manager_name}
                      onChange={(e) => setNewClinic(prev => ({ ...prev, manager_name: e.target.value }))}
                      placeholder="הזן שם המנהל"
                    />
                  </div>
                  <div>
                    <Label htmlFor="license">מספר רישיון</Label>
                    <Input
                      id="license"
                      value={newClinic.license_number}
                      onChange={(e) => setNewClinic(prev => ({ ...prev, license_number: e.target.value }))}
                      placeholder="הזן מספר רישיון"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    ביטול
                  </Button>
                  <Button onClick={handleAddClinic}>
                    הוסף מרפאה
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">סה"כ מרפאות</p>
                    <p className="text-2xl font-bold">{clinics.length}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">מרפאות פעילות</p>
                    <p className="text-2xl font-bold">{clinics.filter(c => c.is_active).length}</p>
                  </div>
                  <Eye className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">מרפאות לא פעילות</p>
                    <p className="text-2xl font-bold">{clinics.filter(c => !c.is_active).length}</p>
                  </div>
                  <EyeOff className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <Card className="bg-white/80 backdrop-blur-sm mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="חיפוש מרפאות..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <div className="text-sm text-gray-600">
                  מציג {filteredClinics.length} מתוך {clinics.length} מרפאות
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clinics Table */}
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              רשימת מרפאות
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם המרפאה</TableHead>
                  <TableHead>כתובת</TableHead>
                  <TableHead>מנהל</TableHead>
                  <TableHead>טלפון</TableHead>
                  <TableHead>אימייל</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClinics.map((clinic) => (
                  <TableRow key={clinic.id}>
                    <TableCell className="font-medium">{clinic.name}</TableCell>
                    <TableCell>
                      {clinic.address ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="max-w-xs truncate">{clinic.address}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">לא צוין</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {clinic.manager_name ? (
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          {clinic.manager_name}
                        </div>
                      ) : (
                        <span className="text-gray-400">לא צוין</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {clinic.phone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          {clinic.phone}
                        </div>
                      ) : (
                        <span className="text-gray-400">לא צוין</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {clinic.email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          {clinic.email}
                        </div>
                      ) : (
                        <span className="text-gray-400">לא צוין</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={clinic.is_active ? "default" : "secondary"}>
                        {clinic.is_active ? 'פעיל' : 'לא פעיל'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingClinic(clinic);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewClinicSettings(clinic.id!)}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleClinicStatus(clinic)}
                        >
                          {clinic.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClinic(clinic.id!)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredClinics.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>לא נמצאו מרפאות</p>
                {clinics.length === 0 && (
                  <Button onClick={() => setIsAddDialogOpen(true)} className="mt-4" size="sm">
                    הוסף מרפאה ראשונה
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Clinic Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>עריכת מרפאה</DialogTitle>
              <DialogDescription>
                ערוך את פרטי המרפאה
              </DialogDescription>
            </DialogHeader>
            {editingClinic && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-name">שם המרפאה</Label>
                  <Input
                    id="edit-name"
                    value={editingClinic.name}
                    onChange={(e) => setEditingClinic(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-address">כתובת</Label>
                  <Textarea
                    id="edit-address"
                    value={editingClinic.address || ''}
                    onChange={(e) => setEditingClinic(prev => prev ? ({ ...prev, address: e.target.value }) : null)}
                    rows={2}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-phone">טלפון</Label>
                  <Input
                    id="edit-phone"
                    value={editingClinic.phone || ''}
                    onChange={(e) => setEditingClinic(prev => prev ? ({ ...prev, phone: e.target.value }) : null)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-email">אימייל</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingClinic.email || ''}
                    onChange={(e) => setEditingClinic(prev => prev ? ({ ...prev, email: e.target.value }) : null)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-manager">שם המנהל</Label>
                  <Input
                    id="edit-manager"
                    value={editingClinic.manager_name || ''}
                    onChange={(e) => setEditingClinic(prev => prev ? ({ ...prev, manager_name: e.target.value }) : null)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-license">מספר רישיון</Label>
                  <Input
                    id="edit-license"
                    value={editingClinic.license_number || ''}
                    onChange={(e) => setEditingClinic(prev => prev ? ({ ...prev, license_number: e.target.value }) : null)}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                ביטול
              </Button>
              <Button onClick={handleEditClinic}>
                שמור שינויים
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ControlCenterClinicsPage;