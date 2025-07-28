import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRouter } from '@tanstack/react-router';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  ArrowLeft,
  UserCheck,
  UserX,
  Building2,
  Mail,
  Phone
} from 'lucide-react';
import { toast } from 'sonner';
import type { Company, Clinic, User } from '@/lib/db/schema';

interface UserWithClinic extends User {
  clinic_name?: string;
}

const ControlCenterUsersPage: React.FC = () => {
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [users, setUsers] = useState<UserWithClinic[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithClinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClinic, setSelectedClinic] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithClinic | null>(null);

  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    role: 'user',
    clinic_id: '',
    is_active: true
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, selectedClinic, selectedRole]);

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

      // Load all users and match them with clinics
      const allUsers = await window.electronAPI.db('getAllUsers');
      const usersWithClinics = (allUsers || []).map((user: User) => {
        const clinic = clinicsResult?.find((c: Clinic) => c.id === user.clinic_id);
        return {
          ...user,
          clinic_name: clinic?.name || 'ללא מרפאה'
        };
      });

      setUsers(usersWithClinics);
    } catch (error) {
      console.error('Error loading users data:', error);
      toast.error('שגיאה בטעינת נתוני המשתמשים');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.phone?.includes(searchTerm)
      );
    }

    // Filter by clinic
    if (selectedClinic !== 'all') {
      filtered = filtered.filter(user => user.clinic_id?.toString() === selectedClinic);
    }

    // Filter by role
    if (selectedRole !== 'all') {
      filtered = filtered.filter(user => user.role === selectedRole);
    }

    setFilteredUsers(filtered);
  };

  const handleAddUser = async () => {
    try {
      if (!newUser.username.trim()) {
        toast.error('שם משתמש הוא שדה חובה');
        return;
      }

      const userData = {
        ...newUser,
        clinic_id: newUser.clinic_id ? parseInt(newUser.clinic_id) : null
      };

      const createdUser = await window.electronAPI.db('createUser', userData);
      
      if (createdUser) {
        toast.success('המשתמש נוסף בהצלחה');
        setIsAddDialogOpen(false);
        setNewUser({
          username: '',
          email: '',
          phone: '',
          password: '',
          role: 'user',
          clinic_id: '',
          is_active: true
        });
        loadData();
      } else {
        toast.error('שגיאה ביצירת המשתמש');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('שגיאה ביצירת המשתמש');
    }
  };

  const handleEditUser = async () => {
    try {
      if (!editingUser) return;

      const updatedUser = await window.electronAPI.db('updateUser', editingUser);
      
      if (updatedUser) {
        toast.success('המשתמש עודכן בהצלחה');
        setIsEditDialogOpen(false);
        setEditingUser(null);
        loadData();
      } else {
        toast.error('שגיאה בעדכון המשתמש');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('שגיאה בעדכון המשתמש');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      const confirmed = window.confirm('האם אתה בטוח שברצונך למחוק את המשתמש?');
      if (!confirmed) return;

      const success = await window.electronAPI.db('deleteUser', userId);
      
      if (success) {
        toast.success('המשתמש נמחק בהצלחה');
        loadData();
      } else {
        toast.error('שגיאה במחיקת המשתמש');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('שגיאה במחיקת המשתמש');
    }
  };

  const handleToggleUserStatus = async (user: UserWithClinic) => {
    try {
      const updatedUser = {
        ...user,
        is_active: !user.is_active
      };

      const result = await window.electronAPI.db('updateUser', updatedUser);
      
      if (result) {
        toast.success(`המשתמש ${user.is_active ? 'הושבת' : 'הופעל'} בהצלחה`);
        loadData();
      } else {
        toast.error('שגיאה בעדכון סטטוס המשתמש');
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast.error('שגיאה בעדכון סטטוס המשתמש');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'doctor': return 'bg-green-100 text-green-800';
      case 'user': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin': return 'מנהל מערכת';
      case 'manager': return 'מנהל';
      case 'doctor': return 'רופא';
      case 'user': return 'משתמש';
      default: return role;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען נתוני משתמשים...</p>
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
                  ניהול משתמשים - {company?.name}
                </h1>
                <p className="text-gray-600">
                  ניהול כל המשתמשים במערכת
                </p>
              </div>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 ml-2" />
                  הוסף משתמש
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>הוסף משתמש חדש</DialogTitle>
                  <DialogDescription>
                    הזן את פרטי המשתמש החדש
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="username">שם משתמש *</Label>
                    <Input
                      id="username"
                      value={newUser.username}
                      onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="הזן שם משתמש"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">אימייל</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="הזן אימייל"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">טלפון</Label>
                    <Input
                      id="phone"
                      value={newUser.phone}
                      onChange={(e) => setNewUser(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="הזן מספר טלפון"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">סיסמה</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="הזן סיסמה"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">תפקיד</Label>
                    <Select value={newUser.role} onValueChange={(value) => setNewUser(prev => ({ ...prev, role: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">משתמש</SelectItem>
                        <SelectItem value="doctor">רופא</SelectItem>
                        <SelectItem value="manager">מנהל</SelectItem>
                        <SelectItem value="admin">מנהל מערכת</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="clinic">מרפאה</Label>
                    <Select value={newUser.clinic_id} onValueChange={(value) => setNewUser(prev => ({ ...prev, clinic_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר מרפאה" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">ללא מרפאה</SelectItem>
                        {clinics.map((clinic) => (
                          <SelectItem key={clinic.id} value={clinic.id!.toString()}>
                            {clinic.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    ביטול
                  </Button>
                  <Button onClick={handleAddUser}>
                    הוסף משתמש
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">סה"כ משתמשים</p>
                    <p className="text-2xl font-bold">{users.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">משתמשים פעילים</p>
                    <p className="text-2xl font-bold">{users.filter(u => u.is_active).length}</p>
                  </div>
                  <UserCheck className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">רופאים</p>
                    <p className="text-2xl font-bold">{users.filter(u => u.role === 'doctor').length}</p>
                  </div>
                  <UserCheck className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">מנהלים</p>
                    <p className="text-2xl font-bold">{users.filter(u => u.role === 'admin' || u.role === 'manager').length}</p>
                  </div>
                  <UserCheck className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="bg-white/80 backdrop-blur-sm mb-6">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="חיפוש משתמשים..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Select value={selectedClinic} onValueChange={setSelectedClinic}>
                  <SelectTrigger>
                    <SelectValue placeholder="כל המרפאות" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל המרפאות</SelectItem>
                    {clinics.map((clinic) => (
                      <SelectItem key={clinic.id} value={clinic.id!.toString()}>
                        {clinic.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="כל התפקידים" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">כל התפקידים</SelectItem>
                    <SelectItem value="admin">מנהל מערכת</SelectItem>
                    <SelectItem value="manager">מנהל</SelectItem>
                    <SelectItem value="doctor">רופא</SelectItem>
                    <SelectItem value="user">משתמש</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-sm text-gray-600 flex items-center">
                  מציג {filteredUsers.length} מתוך {users.length} משתמשים
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              רשימת משתמשים
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם משתמש</TableHead>
                  <TableHead>אימייל</TableHead>
                  <TableHead>טלפון</TableHead>
                  <TableHead>תפקיד</TableHead>
                  <TableHead>מרפאה</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>
                      {user.email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          {user.email}
                        </div>
                      ) : (
                        <span className="text-gray-400">לא צוין</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.phone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          {user.phone}
                        </div>
                      ) : (
                        <span className="text-gray-400">לא צוין</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {getRoleDisplayName(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        {user.clinic_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "secondary"}>
                        {user.is_active ? 'פעיל' : 'לא פעיל'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingUser(user);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleUserStatus(user)}
                        >
                          {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id!)}
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
            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>לא נמצאו משתמשים</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>עריכת משתמש</DialogTitle>
              <DialogDescription>
                ערוך את פרטי המשתמש
              </DialogDescription>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-username">שם משתמש</Label>
                  <Input
                    id="edit-username"
                    value={editingUser.username}
                    onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, username: e.target.value }) : null)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-email">אימייל</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingUser.email || ''}
                    onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, email: e.target.value }) : null)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-phone">טלפון</Label>
                  <Input
                    id="edit-phone"
                    value={editingUser.phone || ''}
                    onChange={(e) => setEditingUser(prev => prev ? ({ ...prev, phone: e.target.value }) : null)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-role">תפקיד</Label>
                  <Select 
                    value={editingUser.role} 
                    onValueChange={(value) => setEditingUser(prev => prev ? ({ ...prev, role: value }) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">משתמש</SelectItem>
                      <SelectItem value="doctor">רופא</SelectItem>
                      <SelectItem value="manager">מנהל</SelectItem>
                      <SelectItem value="admin">מנהל מערכת</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-clinic">מרפאה</Label>
                  <Select 
                    value={editingUser.clinic_id?.toString() || ''} 
                    onValueChange={(value) => setEditingUser(prev => prev ? ({ ...prev, clinic_id: value ? parseInt(value) : null }) : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="בחר מרפאה" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">ללא מרפאה</SelectItem>
                      {clinics.map((clinic) => (
                        <SelectItem key={clinic.id} value={clinic.id!.toString()}>
                          {clinic.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                ביטול
              </Button>
              <Button onClick={handleEditUser}>
                שמור שינויים
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ControlCenterUsersPage;