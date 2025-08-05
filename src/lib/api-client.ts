import { 
  User, Company, Clinic, Client, Family, Settings, OpticalExam, Appointment, 
  File, MedicalLog, Order, Billing, ExamLayout, ExamLayoutInstance,
  LookupSupplier, LookupClinic, LookupOrderType, LookupReferralType,
  LookupLensModel, LookupColor, LookupMaterial, LookupCoating,
  LookupManufacturer, LookupFrameModel, LookupContactLensType,
  LookupContactEyeLensType, LookupContactEyeMaterial, LookupCleaningSolution,
  LookupDisinfectionSolution, LookupRinsingSolution, LookupManufacturingLab,
  LookupAdvisor, Referral, ReferralEye, OrderEye, OrderDetails, OrderLineItem,
  ContactLensOrder, ContactLensDiameters, ContactLensDetails,
  KeratometerContactLens, ContactLensExam, OldContactLenses,
  OverRefraction, WorkShift, Campaign, CampaignClientExecution,
  Chat, ChatMessage, EmailLog, NotesExam, OldRefExam,
  UncorrectedVAExam, KeratometerExam, KeratometerFullExam,
  CornealTopographyExam, CoverTestExam, SchirmerTestExam,
  AnamnesisExam, SensationVisionStabilityExam, DiopterAdjustmentPanel,
  FusionRangeExam, MaddoxRodExam, StereoTestExam, RGExam,
  OcularMotorAssessmentExam, OldRefractionExam, OldRefractionExtensionExam,
  ObjectiveExam, SubjectiveExam, AdditionExam, FinalSubjectiveExam,
  FinalPrescriptionExam, RetinoscopExam, RetinoscopDilationExam,
  CompactPrescriptionExam
} from './db/schema-interface';

const API_BASE_URL = 'http://localhost:8001/api/v1';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    // Check if localStorage is available (renderer process) before using it
    if (typeof localStorage !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 422) {
          // Handle validation errors
          if (errorData.detail && Array.isArray(errorData.detail)) {
            const validationErrors = errorData.detail.map((err: any) => 
              `${err.loc?.join('.') || 'field'}: ${err.msg}`
            ).join(', ');
            return { error: validationErrors };
          }
        }
        
        return { error: errorData.detail || `HTTP ${response.status}` };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  setToken(token: string) {
    this.token = token;
    // Check if localStorage is available (renderer process) before using it
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  clearToken() {
    this.token = null;
    // Check if localStorage is available (renderer process) before using it
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('auth_token');
    }
  }

  // Authentication
  async login(username: string, password: string) {
    const response = await this.request<{ access_token: string; token_type: string }>('/auth/login-json', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (response.data) {
      this.setToken(response.data.access_token);
    }

    return response;
  }

  async loginWithoutPassword(username: string) {
    const response = await this.request<{ access_token: string; token_type: string }>('/auth/login-no-password', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });

    if (response.data) {
      this.setToken(response.data.access_token);
    }

    return response;
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async authenticateUser(username: string, password?: string) {
    const tokenResponse = await this.request<{access_token: string, token_type: string}>('/auth/login-json', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    
    if (tokenResponse.data?.access_token) {
      // Set the token for future requests
      this.setToken(tokenResponse.data.access_token);
      
      // Get the user data using the token
      const userResponse = await this.request<User>('/auth/me');
      return userResponse;
    }
    
    return tokenResponse;
  }

  // Companies
  async getCompanies() {
    return this.request<Company[]>('/companies');
  }

  async getCompaniesPublic() {
    return this.request<Company[]>('/companies/public');
  }

  async getCompany(id: number) {
    return this.request<Company>(`/companies/${id}`);
  }

  async createCompany(data: any) {
    return this.request('/companies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createCompanyPublic(data: any) {
    return this.request('/companies/public', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCompany(id: number, company: any) {
    return this.request<Company>(`/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(company),
    });
  }

  async deleteCompany(id: number) {
    return this.request(`/companies/${id}`, {
      method: 'DELETE',
    });
  }

  // Clinics
  async getClinics() {
    return this.request<Clinic[]>('/clinics');
  }

  async getClinic(id: number) {
    return this.request<Clinic>(`/clinics/${id}`);
  }

  async getClinicByUniqueId(uniqueId: string) {
    return this.request<Clinic>(`/clinics/unique/${uniqueId}`);
  }

  async getClinicsByCompany(companyId: number) {
    return this.request<Clinic[]>(`/clinics/company/${companyId}`);
  }

  async getActiveClinics() {
    return this.request<Clinic[]>('/clinics/active');
  }

  async createClinic(clinic: any) {
    return this.request<Clinic>('/clinics', {
      method: 'POST',
      body: JSON.stringify(clinic),
    });
  }

  async updateClinic(id: number, clinic: any) {
    return this.request<Clinic>(`/clinics/${id}`, {
      method: 'PUT',
      body: JSON.stringify(clinic),
    });
  }

  async deleteClinic(id: number) {
    return this.request(`/clinics/${id}`, {
      method: 'DELETE',
    });
  }

  // Users
  async getUsers() {
    return this.request<User[]>('/users');
  }

  async getUser(id: number) {
    return this.request<User>(`/users/${id}`);
  }

  async getUserByUsername(username: string) {
    return this.request<User>(`/users/username/${username}`);
  }

  async getUserByUsernamePublic(username: string) {
    return this.request<User>(`/users/username/${username}/public`);
  }

  async getUsersByClinic(clinicId: number) {
    return this.request<User[]>(`/users/clinic/${clinicId}`);
  }

  async getUsersByClinicPublic(clinicId: number) {
    return this.request<User[]>(`/users/clinic/${clinicId}/public`);
  }

  async getUsersByCompany(companyId: number) {
    return this.request<User[]>(`/users/company/${companyId}`);
  }

  async createUser(data: any) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createUserPublic(data: any) {
    return this.request('/users/public', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id: number, user: any) {
    return this.request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    });
  }

  async deleteUser(id: number) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  async connectGoogleAccount(userId: number, googleEmail: string, accessToken: string, refreshToken: string) {
    return this.request(`/users/${userId}/google-connect`, {
      method: 'POST',
      body: JSON.stringify({ googleEmail, accessToken, refreshToken }),
    });
  }

  async disconnectGoogleAccount(userId: number) {
    return this.request(`/users/${userId}/google-disconnect`, {
      method: 'DELETE',
    });
  }

  // Clients
  async getClients(clinicId?: number) {
    const url = clinicId ? `/clients?clinic_id=${clinicId}` : '/clients';
    return this.request<Client[]>(url);
  }

  async getClient(id: number) {
    return this.request<Client>(`/clients/${id}`);
  }

  async createClient(client: any) {
    return this.request<Client>('/clients', {
      method: 'POST',
      body: JSON.stringify(client),
    });
  }

  async updateClient(id: number, client: any) {
    return this.request<Client>(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(client),
    });
  }

  async deleteClient(id: number) {
    return this.request(`/clients/${id}`, {
      method: 'DELETE',
    });
  }

  async updateClientUpdatedDate(clientId: number) {
    return this.request(`/clients/${clientId}/update-date`, {
      method: 'PUT',
    });
  }

  async updateClientAiStates(clientId: number, aiStates: { [key: string]: string }) {
    return this.request(`/clients/${clientId}/ai-states`, {
      method: 'PUT',
      body: JSON.stringify(aiStates),
    });
  }

  async updateClientAiPartState(clientId: number, part: string, aiPartState: string) {
    return this.request(`/clients/${clientId}/ai-state/${part}`, {
      method: 'PUT',
      body: JSON.stringify({ state: aiPartState }),
    });
  }

  async getAllClientDataForAi(clientId: number) {
    return this.request(`/clients/${clientId}/ai-data`);
  }

  // Families
  async getFamilies(clinicId?: number) {
    const url = clinicId ? `/families?clinic_id=${clinicId}` : '/families';
    return this.request<Family[]>(url);
  }

  async getFamily(id: number) {
    return this.request<Family>(`/families/${id}`);
  }

  async createFamily(family: any) {
    return this.request<Family>('/families', {
      method: 'POST',
      body: JSON.stringify(family),
    });
  }

  async updateFamily(id: number, family: any) {
    return this.request<Family>(`/families/${id}`, {
      method: 'PUT',
      body: JSON.stringify(family),
    });
  }

  async deleteFamily(id: number) {
    return this.request(`/families/${id}`, {
      method: 'DELETE',
    });
  }

  async getFamilyMembers(familyId: number) {
    return this.request<Client[]>(`/families/${familyId}/members`);
  }

  async addClientToFamily(clientId: number, familyId: number, role: string) {
    return this.request(`/families/${familyId}/members`, {
      method: 'POST',
      body: JSON.stringify({ client_id: clientId, role }),
    });
  }

  async removeClientFromFamily(clientId: number) {
    return this.request(`/clients/${clientId}/family`, {
      method: 'DELETE',
    });
  }

  // Exams
  async getExams(type?: string, clinicId?: number) {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (clinicId) params.append('clinic_id', clinicId.toString());
    const url = `/exams${params.toString() ? '?' + params.toString() : ''}`;
    return this.request<OpticalExam[]>(url);
  }

  async getExam(id: number) {
    return this.request<OpticalExam>(`/exams/${id}`);
  }

  async getExamsByClient(clientId: number, type?: string) {
    const url = type ? `/exams/client/${clientId}?type=${type}` : `/exams/client/${clientId}`;
    return this.request<OpticalExam[]>(url);
  }

  async createExam(exam: any) {
    return this.request<OpticalExam>('/exams', {
      method: 'POST',
      body: JSON.stringify(exam),
    });
  }

  async updateExam(id: number, exam: any) {
    return this.request<OpticalExam>(`/exams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(exam),
    });
  }

  async deleteExam(id: number) {
    return this.request(`/exams/${id}`, {
      method: 'DELETE',
    });
  }

  async getEnrichedExams(type?: string, clinicId?: number) {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (clinicId) params.append('clinic_id', clinicId.toString());
    
    const queryString = params.toString();
    const url = `/exams/enriched${queryString ? `?${queryString}` : ''}`;
    
    return this.request(url);
  }

  // Exam Layouts
  async getExamLayouts(clinicId?: number, type?: string) {
    const params = new URLSearchParams();
    if (clinicId) params.append('clinic_id', clinicId.toString());
    if (type) params.append('type', type);
    const url = `/exam-layouts${params.toString() ? '?' + params.toString() : ''}`;
    return this.request<ExamLayout[]>(url);
  }

  async getExamLayout(id: number) {
    return this.request<ExamLayout>(`/exam-layouts/${id}`);
  }

  async getDefaultExamLayouts() {
    return this.request<ExamLayout[]>('/exam-layouts/default');
  }

  async getLayoutsByExam(examId: number) {
    return this.request<ExamLayout[]>(`/exam-layouts/exam/${examId}`);
  }

  async createExamLayout(layout: any) {
    return this.request<ExamLayout>('/exam-layouts', {
      method: 'POST',
      body: JSON.stringify(layout),
    });
  }

  async updateExamLayout(id: number, layout: any) {
    return this.request<ExamLayout>(`/exam-layouts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(layout),
    });
  }

  async deleteExamLayout(id: number) {
    return this.request(`/exam-layouts/${id}`, {
      method: 'DELETE',
    });
  }

  // Exam Layout Instances
  async getExamLayoutInstances(examId: number) {
    return this.request<ExamLayoutInstance[]>(`/exam-layouts/instances/exam/${examId}`);
  }

  async getActiveExamLayoutInstance(examId: number) {
    return this.request<ExamLayoutInstance>(`/exam-layouts/instances/exam/${examId}/active`);
  }

  async createExamLayoutInstance(instance: any) {
    return this.request<ExamLayoutInstance>('/exam-layouts/instances', {
      method: 'POST',
      body: JSON.stringify(instance),
    });
  }

  async updateExamLayoutInstance(id: number, instance: any) {
    return this.request<ExamLayoutInstance>(`/exam-layouts/instances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(instance),
    });
  }

  async deleteExamLayoutInstance(id: number) {
    return this.request(`/exam-layouts/instances/${id}`, {
      method: 'DELETE',
    });
  }

  async setActiveExamLayoutInstance(examId: number, layoutInstanceId: number) {
    return this.request(`/exam-layouts/instances/exam/${examId}/set-active/${layoutInstanceId}`, {
      method: 'POST',
    });
  }



  // Appointments
  async getAppointments(clinicId?: number) {
    const url = clinicId ? `/appointments?clinic_id=${clinicId}` : '/appointments';
    return this.request<Appointment[]>(url);
  }

  async getAppointment(id: number) {
    return this.request<Appointment>(`/appointments/${id}`);
  }

  async getAppointmentsByClient(clientId: number) {
    return this.request<Appointment[]>(`/appointments/client/${clientId}`);
  }

  async getAppointmentsByUser(userId: number) {
    return this.request<Appointment[]>(`/appointments/user/${userId}`);
  }

  async createAppointment(appointment: any) {
    console.log('API Client - Creating appointment with payload:', appointment);
    return this.request<Appointment>('/appointments', {
      method: 'POST',
      body: JSON.stringify(appointment),
    });
  }

  async updateAppointment(id: number, appointment: any) {
    return this.request<Appointment>(`/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(appointment),
    });
  }

  async deleteAppointment(id: number) {
    return this.request(`/appointments/${id}`, {
      method: 'DELETE',
    });
  }

  async updateAppointmentGoogleEventId(appointmentId: number, googleEventId: string | null) {
    return this.request(`/appointments/${appointmentId}/google-event`, {
      method: 'PUT',
      body: JSON.stringify({ googleEventId }),
    });
  }

  // Files
  async getFiles(clinicId?: number) {
    const url = clinicId ? `/files?clinic_id=${clinicId}` : '/files';
    return this.request<File[]>(url);
  }

  async getFile(id: number) {
    return this.request<File>(`/files/${id}`);
  }

  async getFilesByClient(clientId: number) {
    return this.request<File[]>(`/files/client/${clientId}`);
  }

  async createFile(file: any) {
    return this.request<File>('/files', {
      method: 'POST',
      body: JSON.stringify(file),
    });
  }

  async updateFile(id: number, file: any) {
    return this.request<File>(`/files/${id}`, {
      method: 'PUT',
      body: JSON.stringify(file),
    });
  }

  async deleteFile(id: number) {
    return this.request(`/files/${id}`, {
      method: 'DELETE',
    });
  }

  // Medical Logs
  async getMedicalLogs(clinicId?: number) {
    const url = clinicId ? `/medical-logs?clinic_id=${clinicId}` : '/medical-logs';
    return this.request<MedicalLog[]>(url);
  }

  async getMedicalLog(id: number) {
    return this.request<MedicalLog>(`/medical-logs/${id}`);
  }

  async getMedicalLogsByClient(clientId: number) {
    return this.request<MedicalLog[]>(`/medical-logs/client/${clientId}`);
  }

  async createMedicalLog(log: any) {
    return this.request<MedicalLog>('/medical-logs', {
      method: 'POST',
      body: JSON.stringify(log),
    });
  }

  async updateMedicalLog(id: number, log: any) {
    return this.request<MedicalLog>(`/medical-logs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(log),
    });
  }

  async deleteMedicalLog(id: number) {
    return this.request(`/medical-logs/${id}`, {
      method: 'DELETE',
    });
  }

  // Orders
  async getOrders(clinicId?: number) {
    const url = clinicId ? `/orders?clinic_id=${clinicId}` : '/orders';
    return this.request<Order[]>(url);
  }

  async getOrder(id: number) {
    return this.request<Order>(`/orders/${id}`);
  }

  async getOrdersByClient(clientId: number) {
    return this.request<Order[]>(`/orders/client/${clientId}`);
  }

  async createOrder(order: any) {
    return this.request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  async updateOrder(id: number, order: any) {
    return this.request<Order>(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(order),
    });
  }

  async deleteOrder(id: number) {
    return this.request(`/orders/${id}`, {
      method: 'DELETE',
    });
  }

  // Order Eyes
  async getOrderEyes(orderId: number) {
    return this.request<OrderEye[]>(`/order-eyes/order/${orderId}`);
  }

  async createOrderEye(orderEye: any) {
    return this.request<OrderEye>('/order-eyes', {
      method: 'POST',
      body: JSON.stringify(orderEye),
    });
  }

  async updateOrderEye(id: number, orderEye: any) {
    return this.request<OrderEye>(`/order-eyes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(orderEye),
    });
  }

  // Order Details
  async getOrderDetails(orderId: number) {
    return this.request<OrderDetails>(`/order-details/order/${orderId}`);
  }

  async createOrderDetails(orderDetails: any) {
    return this.request<OrderDetails>('/order-details', {
      method: 'POST',
      body: JSON.stringify(orderDetails),
    });
  }

  async updateOrderDetails(id: number, orderDetails: any) {
    return this.request<OrderDetails>(`/order-details/${id}`, {
      method: 'PUT',
      body: JSON.stringify(orderDetails),
    });
  }

  // Billing
  async getBillingByOrder(orderId: number) {
    return this.request<Billing>(`/billing/order/${orderId}`);
  }

  async getBillingByContactLens(contactLensId: number) {
    return this.request<Billing>(`/billing/contact-lens/${contactLensId}`);
  }

  async getBillingsByClient(clientId: number) {
    return this.request<Billing[]>(`/billing/client/${clientId}`);
  }

  async createBilling(billing: any) {
    return this.request<Billing>('/billing', {
      method: 'POST',
      body: JSON.stringify(billing),
    });
  }

  async updateBilling(id: number, billing: any) {
    return this.request<Billing>(`/billing/${id}`, {
      method: 'PUT',
      body: JSON.stringify(billing),
    });
  }

  // Order Line Items
  async getOrderLineItems(billingId: number) {
    return this.request<OrderLineItem[]>(`/order-line-items/billing/${billingId}`);
  }

  async createOrderLineItem(orderLineItem: any) {
    return this.request<OrderLineItem>('/order-line-items', {
      method: 'POST',
      body: JSON.stringify(orderLineItem),
    });
  }

  async updateOrderLineItem(id: number, orderLineItem: any) {
    return this.request<OrderLineItem>(`/order-line-items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(orderLineItem),
    });
  }

  async deleteOrderLineItem(id: number) {
    return this.request(`/order-line-items/${id}`, {
      method: 'DELETE',
    });
  }

  // Referrals
  async getReferrals(clinicId?: number) {
    const url = clinicId ? `/referrals?clinic_id=${clinicId}` : '/referrals';
    return this.request<Referral[]>(url);
  }

  async getReferral(id: number) {
    return this.request<Referral>(`/referrals/${id}`);
  }

  async getReferralsByClient(clientId: number) {
    return this.request<Referral[]>(`/referrals/client/${clientId}`);
  }

  async createReferral(referral: any) {
    return this.request<Referral>('/referrals', {
      method: 'POST',
      body: JSON.stringify(referral),
    });
  }

  async updateReferral(id: number, referral: any) {
    return this.request<Referral>(`/referrals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(referral),
    });
  }

  async deleteReferral(id: number) {
    return this.request(`/referrals/${id}`, {
      method: 'DELETE',
    });
  }

  // Referral Eyes
  async getReferralEyes(referralId: number) {
    return this.request<ReferralEye[]>(`/referral-eyes/referral/${referralId}`);
  }

  async createReferralEye(referralEye: any) {
    return this.request<ReferralEye>('/referral-eyes', {
      method: 'POST',
      body: JSON.stringify(referralEye),
    });
  }

  async updateReferralEye(id: number, referralEye: any) {
    return this.request<ReferralEye>(`/referral-eyes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(referralEye),
    });
  }

  // Work Shifts
  async getWorkShifts(userId: number) {
    return this.request<WorkShift[]>(`/work-shifts/user/${userId}`);
  }

  async getWorkShiftsByUserAndMonth(userId: number, year: number, month: number) {
    return this.request<WorkShift[]>(`/work-shifts/user/${userId}/month/${year}/${month}`);
  }

  async getWorkShiftsByUserAndDate(userId: number, date: string) {
    return this.request<WorkShift[]>(`/work-shifts/user/${userId}/date/${date}`);
  }

  async getActiveWorkShift(userId: number) {
    return this.request<WorkShift>(`/work-shifts/user/${userId}/active`);
  }

  async createWorkShift(workShift: any) {
    return this.request<WorkShift>('/work-shifts', {
      method: 'POST',
      body: JSON.stringify(workShift),
    });
  }

  async updateWorkShift(id: number, workShift: any) {
    return this.request<WorkShift>(`/work-shifts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(workShift),
    });
  }

  async deleteWorkShift(id: number) {
    return this.request(`/work-shifts/${id}`, {
      method: 'DELETE',
    });
  }

  async getWorkShiftStats(userId: number, year: number, month: number) {
    return this.request(`/work-shifts/user/${userId}/stats/${year}/${month}`);
  }

  // Campaigns
  async getCampaigns(clinicId?: number) {
    const url = clinicId ? `/campaigns?clinic_id=${clinicId}` : '/campaigns';
    return this.request<Campaign[]>(url);
  }

  async getCampaign(id: number) {
    return this.request<Campaign>(`/campaigns/${id}`);
  }

  async createCampaign(campaign: any) {
    return this.request<Campaign>('/campaigns', {
      method: 'POST',
      body: JSON.stringify(campaign),
    });
  }

  async updateCampaign(id: number, campaign: any) {
    return this.request<Campaign>(`/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(campaign),
    });
  }

  async deleteCampaign(id: number) {
    return this.request(`/campaigns/${id}`, {
      method: 'DELETE',
    });
  }

  async getCampaignClientExecution(campaignId: number, clientId: number) {
    return this.request(`/campaigns/${campaignId}/execution/${clientId}`);
  }

  async addCampaignClientExecution(campaignId: number, clientId: number) {
    return this.request(`/campaigns/${campaignId}/execution`, {
      method: 'POST',
      body: JSON.stringify({ clientId }),
    });
  }

  async deleteCampaignClientExecutions(campaignId: number) {
    return this.request(`/campaigns/${campaignId}/executions`, {
      method: 'DELETE',
    });
  }

  // Chats
  async getChats(clinicId?: number) {
    const url = clinicId ? `/chats?clinic_id=${clinicId}` : '/chats';
    return this.request<Chat[]>(url);
  }

  async getChat(id: number) {
    return this.request<Chat>(`/chats/${id}`);
  }

  async createChat(title: string, clinicId?: number) {
    return this.request<Chat>('/chats', {
      method: 'POST',
      body: JSON.stringify({ title, clinic_id: clinicId }),
    });
  }

  async updateChat(id: number, chat: any) {
    return this.request<Chat>(`/chats/${id}`, {
      method: 'PUT',
      body: JSON.stringify(chat),
    });
  }

  async deleteChat(id: number) {
    return this.request(`/chats/${id}`, {
      method: 'DELETE',
    });
  }

  // Chat Messages
  async getChatMessages(chatId: number) {
    return this.request<ChatMessage[]>(`/chat-messages/chat/${chatId}`);
  }

  async createChatMessage(chatMessage: any) {
    return this.request<ChatMessage>('/chat-messages', {
      method: 'POST',
      body: JSON.stringify(chatMessage),
    });
  }

  async updateChatMessage(id: number, chatMessage: any) {
    return this.request<ChatMessage>(`/chat-messages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(chatMessage),
    });
  }

  async deleteChatMessage(id: number) {
    return this.request(`/chat-messages/${id}`, {
      method: 'DELETE',
    });
  }

  // Email Logs
  async getEmailLogs() {
    return this.request<EmailLog[]>('/email-logs');
  }

  async getEmailLogsByAppointment(appointmentId: number) {
    return this.request<EmailLog[]>(`/email-logs/appointment/${appointmentId}`);
  }

  async createEmailLog(emailLog: any) {
    return this.request<EmailLog>('/email-logs', {
      method: 'POST',
      body: JSON.stringify(emailLog),
    });
  }

  // Settings
  async getSettings(clinicId?: number) {
    const url = clinicId ? `/settings/clinic/${clinicId}` : '/settings';
    return this.request<Settings>(url);
  }

  async getSettingsByClinic(clinicId: number) {
    return this.request<Settings>(`/settings/clinic/${clinicId}`);
  }

  async getAllSettingsByCompany(companyId: number) {
    return this.request<Settings[]>(`/settings/company/${companyId}`);
  }

  async updateSettings(settings: any) {
    return this.request<Settings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async createSettings(settings: any) {
    return this.request<Settings>('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  // Additional convenience methods
  async getClientById(id: number) {
    return this.getClient(id);
  }

  async getAppointmentById(id: number) {
    return this.getAppointment(id);
  }

  async getAllCampaigns() {
    return this.getCampaigns();
  }

  async getCampaignById(id: number) {
    return this.getCampaign(id);
  }

  async getAllClients() {
    return this.getClients();
  }

  async getAllAppointments() {
    return this.getAppointments();
  }

  async getAllExams() {
    return this.getExams();
  }

  async getAllOrders() {
    return this.getOrders();
  }

  // Lookup Tables - Generic methods for all lookup tables
  async getLookupTable(tableName: string) {
    return this.request(`/lookup/${tableName}`);
  }

  async createLookupItem(tableName: string, item: any) {
    return this.request(`/lookup/${tableName}`, {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  async updateLookupItem(tableName: string, id: number, item: any) {
    return this.request(`/lookup/${tableName}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(item),
    });
  }

  async deleteLookupItem(tableName: string, id: number) {
    return this.request(`/lookup/${tableName}/${id}`, {
      method: 'DELETE',
    });
  }

  // Specific lookup methods for backward compatibility
  async getLookupSuppliers() {
    return this.request<LookupSupplier[]>('/lookup/suppliers');
  }

  async createLookupSupplier(supplier: any) {
    return this.request<LookupSupplier>('/lookup/suppliers', {
      method: 'POST',
      body: JSON.stringify(supplier),
    });
  }

  async updateLookupSupplier(id: number, supplier: any) {
    return this.request<LookupSupplier>(`/lookup/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(supplier),
    });
  }

  async deleteLookupSupplier(id: number) {
    return this.request(`/lookup/suppliers/${id}`, {
      method: 'DELETE',
    });
  }

  // Generic Exam Data Methods
  private async _createExamData<T>(examType: string, data: Omit<T, 'id'>, layoutInstanceId: number): Promise<ApiResponse<T>> {
    return this.request<T>(`/exam-data/${examType}`, {
      method: 'POST',
      body: JSON.stringify({ data, layout_instance_id: layoutInstanceId }),
    });
  }
  
  private async _getExamData<T>(examType: string, layoutInstanceId: number): Promise<ApiResponse<T>> {
    return this.request<T>(`/exam-data/${examType}/${layoutInstanceId}`);
  }
  
  private async _updateExamData<T>(examType: string, id: number, data: Partial<T>): Promise<ApiResponse<T>> {
    return this.request<T>(`/exam-data/${examType}/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ data }),
    });
  }

  // Specific Exam Data Methods
  async createOldRefExam(data: Omit<OldRefExam, 'id'>, layoutInstanceId: number) { return this._createExamData<OldRefExam>('old-ref', data, layoutInstanceId); }
  async getOldRefExam(layoutInstanceId: number) { return this._getExamData<OldRefExam>('old-ref', layoutInstanceId); }
  async updateOldRefExam(id: number, data: Partial<OldRefExam>) { return this._updateExamData<OldRefExam>('old-ref', id, data); }
  
  async createOldRefractionExam(data: Omit<OldRefractionExam, 'id'>, layoutInstanceId: number) { return this._createExamData<OldRefractionExam>('old-refraction', data, layoutInstanceId); }
  async getOldRefractionExam(layoutInstanceId: number) { return this._getExamData<OldRefractionExam>('old-refraction', layoutInstanceId); }
  async updateOldRefractionExam(id: number, data: Partial<OldRefractionExam>) { return this._updateExamData<OldRefractionExam>('old-refraction', id, data); }

  async createObjectiveExam(data: Omit<ObjectiveExam, 'id'>, layoutInstanceId: number) { return this._createExamData<ObjectiveExam>('objective', data, layoutInstanceId); }
  async getObjectiveExam(layoutInstanceId: number) { return this._getExamData<ObjectiveExam>('objective', layoutInstanceId); }
  async updateObjectiveExam(id: number, data: Partial<ObjectiveExam>) { return this._updateExamData<ObjectiveExam>('objective', id, data); }

  async createSubjectiveExam(data: Omit<SubjectiveExam, 'id'>, layoutInstanceId: number) { return this._createExamData<SubjectiveExam>('subjective', data, layoutInstanceId); }
  async getSubjectiveExam(layoutInstanceId: number) { return this._getExamData<SubjectiveExam>('subjective', layoutInstanceId); }
  async updateSubjectiveExam(id: number, data: Partial<SubjectiveExam>) { return this._updateExamData<SubjectiveExam>('subjective', id, data); }

  async createAdditionExam(data: Omit<AdditionExam, 'id'>, layoutInstanceId: number) { return this._createExamData<AdditionExam>('addition', data, layoutInstanceId); }
  async getAdditionExam(layoutInstanceId: number) { return this._getExamData<AdditionExam>('addition', layoutInstanceId); }
  async updateAdditionExam(id: number, data: Partial<AdditionExam>) { return this._updateExamData<AdditionExam>('addition', id, data); }

  async createFinalSubjectiveExam(data: Omit<FinalSubjectiveExam, 'id'>, layoutInstanceId: number) { return this._createExamData<FinalSubjectiveExam>('final-subjective', data, layoutInstanceId); }
  async getFinalSubjectiveExam(layoutInstanceId: number) { return this._getExamData<FinalSubjectiveExam>('final-subjective', layoutInstanceId); }
  async updateFinalSubjectiveExam(id: number, data: Partial<FinalSubjectiveExam>) { return this._updateExamData<FinalSubjectiveExam>('final-subjective', id, data); }
  
  async createFinalPrescriptionExam(data: Omit<FinalPrescriptionExam, 'id'>, layoutInstanceId: number) { return this._createExamData<FinalPrescriptionExam>('final-prescription', data, layoutInstanceId); }
  async getFinalPrescriptionExam(layoutInstanceId: number) { return this._getExamData<FinalPrescriptionExam>('final-prescription', layoutInstanceId); }
  async updateFinalPrescriptionExam(id: number, data: Partial<FinalPrescriptionExam>) { return this._updateExamData<FinalPrescriptionExam>('final-prescription', id, data); }
  
  async createCompactPrescriptionExam(data: Omit<CompactPrescriptionExam, 'id'>, layoutInstanceId: number) { return this._createExamData<CompactPrescriptionExam>('compact-prescription', data, layoutInstanceId); }
  async getCompactPrescriptionExam(layoutInstanceId: number) { return this._getExamData<CompactPrescriptionExam>('compact-prescription', layoutInstanceId); }
  async updateCompactPrescriptionExam(id: number, data: Partial<CompactPrescriptionExam>) { return this._updateExamData<CompactPrescriptionExam>('compact-prescription', id, data); }
  
  async createRetinoscopExam(data: Omit<RetinoscopExam, 'id'>, layoutInstanceId: number) { return this._createExamData<RetinoscopExam>('retinoscop', data, layoutInstanceId); }
  async getRetinoscopExam(layoutInstanceId: number) { return this._getExamData<RetinoscopExam>('retinoscop', layoutInstanceId); }
  async updateRetinoscopExam(id: number, data: Partial<RetinoscopExam>) { return this._updateExamData<RetinoscopExam>('retinoscop', id, data); }
  
  async createRetinoscopDilationExam(data: Omit<RetinoscopDilationExam, 'id'>, layoutInstanceId: number) { return this._createExamData<RetinoscopDilationExam>('retinoscop-dilation', data, layoutInstanceId); }
  async getRetinoscopDilationExam(layoutInstanceId: number) { return this._getExamData<RetinoscopDilationExam>('retinoscop-dilation', layoutInstanceId); }
  async updateRetinoscopDilationExam(id: number, data: Partial<RetinoscopDilationExam>) { return this._updateExamData<RetinoscopDilationExam>('retinoscop-dilation', id, data); }
  
  async createUncorrectedVAExam(data: Omit<UncorrectedVAExam, 'id'>, layoutInstanceId: number) { return this._createExamData<UncorrectedVAExam>('uncorrected-va', data, layoutInstanceId); }
  async getUncorrectedVAExam(layoutInstanceId: number) { return this._getExamData<UncorrectedVAExam>('uncorrected-va', layoutInstanceId); }
  async updateUncorrectedVAExam(id: number, data: Partial<UncorrectedVAExam>) { return this._updateExamData<UncorrectedVAExam>('uncorrected-va', id, data); }

  async createKeratometerExam(data: Omit<KeratometerExam, 'id'>, layoutInstanceId: number) { return this._createExamData<KeratometerExam>('keratometer', data, layoutInstanceId); }
  async getKeratometerExam(layoutInstanceId: number) { return this._getExamData<KeratometerExam>('keratometer', layoutInstanceId); }
  async updateKeratometerExam(id: number, data: Partial<KeratometerExam>) { return this._updateExamData<KeratometerExam>('keratometer', id, data); }

  async createKeratometerFullExam(data: Omit<KeratometerFullExam, 'id'>, layoutInstanceId: number) { return this._createExamData<KeratometerFullExam>('keratometer-full', data, layoutInstanceId); }
  async getKeratometerFullExam(layoutInstanceId: number) { return this._getExamData<KeratometerFullExam>('keratometer-full', layoutInstanceId); }
  async updateKeratometerFullExam(id: number, data: Partial<KeratometerFullExam>) { return this._updateExamData<KeratometerFullExam>('keratometer-full', id, data); }

  async createCornealTopographyExam(data: Omit<CornealTopographyExam, 'id'>, layoutInstanceId: number) { return this._createExamData<CornealTopographyExam>('corneal-topography', data, layoutInstanceId); }
  async getCornealTopographyExam(layoutInstanceId: number) { return this._getExamData<CornealTopographyExam>('corneal-topography', layoutInstanceId); }
  async updateCornealTopographyExam(id: number, data: Partial<CornealTopographyExam>) { return this._updateExamData<CornealTopographyExam>('corneal-topography', id, data); }
  
  async createCoverTestExam(data: Omit<CoverTestExam, 'id'>, layoutInstanceId: number) { return this._createExamData<CoverTestExam>('cover-test', data, layoutInstanceId); }
  async getCoverTestExam(layoutInstanceId: number) { return this._getExamData<CoverTestExam>('cover-test', layoutInstanceId); }
  async updateCoverTestExam(id: number, data: Partial<CoverTestExam>) { return this._updateExamData<CoverTestExam>('cover-test', id, data); }

  async createSchirmerTestExam(data: Omit<SchirmerTestExam, 'id'>, layoutInstanceId: number) { return this._createExamData<SchirmerTestExam>('schirmer-test', data, layoutInstanceId); }
  async getSchirmerTestExam(layoutInstanceId: number) { return this._getExamData<SchirmerTestExam>('schirmer-test', layoutInstanceId); }
  async updateSchirmerTestExam(id: number, data: Partial<SchirmerTestExam>) { return this._updateExamData<SchirmerTestExam>('schirmer-test', id, data); }
  
  async createOldRefractionExtensionExam(data: Omit<OldRefractionExtensionExam, 'id'>, layoutInstanceId: number) { return this._createExamData<OldRefractionExtensionExam>('old-refraction-extension', data, layoutInstanceId); }
  async getOldRefractionExtensionExam(layoutInstanceId: number) { return this._getExamData<OldRefractionExtensionExam>('old-refraction-extension', layoutInstanceId); }
  async updateOldRefractionExtensionExam(id: number, data: Partial<OldRefractionExtensionExam>) { return this._updateExamData<OldRefractionExtensionExam>('old-refraction-extension', id, data); }
  
  async createAnamnesisExam(data: Omit<AnamnesisExam, 'id'>, layoutInstanceId: number) { return this._createExamData<AnamnesisExam>('anamnesis', data, layoutInstanceId); }
  async getAnamnesisExam(layoutInstanceId: number) { return this._getExamData<AnamnesisExam>('anamnesis', layoutInstanceId); }
  async updateAnamnesisExam(id: number, data: Partial<AnamnesisExam>) { return this._updateExamData<AnamnesisExam>('anamnesis', id, data); }
  
  async createNotesExam(data: Omit<NotesExam, 'id'>, layoutInstanceId: number) { return this._createExamData<NotesExam>('notes', data, layoutInstanceId); }
  async getNotesExam(layoutInstanceId: number, cardInstanceId?: string) { return this._getExamData<NotesExam>('notes', layoutInstanceId); }
  async updateNotesExam(id: number, data: Partial<NotesExam>) { return this._updateExamData<NotesExam>('notes', id, data); }

  async createContactLensDiameters(data: Omit<ContactLensDiameters, 'id'>, layoutInstanceId: number) { return this._createExamData<ContactLensDiameters>('contact-lens-diameters', data, layoutInstanceId); }
  async getContactLensDiameters(layoutInstanceId: number) { return this._getExamData<ContactLensDiameters>('contact-lens-diameters', layoutInstanceId); }
  async updateContactLensDiameters(id: number, data: Partial<ContactLensDiameters>) { return this._updateExamData<ContactLensDiameters>('contact-lens-diameters', id, data); }
  
  async createContactLensDetails(data: Omit<ContactLensDetails, 'id'>, layoutInstanceId: number) { return this._createExamData<ContactLensDetails>('contact-lens-details', data, layoutInstanceId); }
  async getContactLensDetails(layoutInstanceId: number) { return this._getExamData<ContactLensDetails>('contact-lens-details', layoutInstanceId); }
  async updateContactLensDetails(id: number, data: Partial<ContactLensDetails>) { return this._updateExamData<ContactLensDetails>('contact-lens-details', id, data); }

  async createKeratometerContactLens(data: Omit<KeratometerContactLens, 'id'>, layoutInstanceId: number) { return this._createExamData<KeratometerContactLens>('keratometer-contact-lens', data, layoutInstanceId); }
  async getKeratometerContactLens(layoutInstanceId: number) { return this._getExamData<KeratometerContactLens>('keratometer-contact-lens', layoutInstanceId); }
  async updateKeratometerContactLens(id: number, data: Partial<KeratometerContactLens>) { return this._updateExamData<KeratometerContactLens>('keratometer-contact-lens', id, data); }
  
  async createContactLensExam(data: Omit<ContactLensExam, 'id'>, layoutInstanceId: number) { return this._createExamData<ContactLensExam>('contact-lens-exam', data, layoutInstanceId); }
  async getContactLensExam(layoutInstanceId: number) { return this._getExamData<ContactLensExam>('contact-lens-exam', layoutInstanceId); }
  async updateContactLensExam(id: number, data: Partial<ContactLensExam>) { return this._updateExamData<ContactLensExam>('contact-lens-exam', id, data); }
  
  async createContactLensOrder(data: Omit<ContactLensOrder, 'id'>, layoutInstanceId: number) { return this._createExamData<ContactLensOrder>('contact-lens-order', data, layoutInstanceId); }
  async getContactLensOrder(layoutInstanceId: number) { return this._getExamData<ContactLensOrder>('contact-lens-order', layoutInstanceId); }
  async updateContactLensOrder(id: number, data: Partial<ContactLensOrder>) { return this._updateExamData<ContactLensOrder>('contact-lens-order', id, data); }

  async createOldContactLenses(data: Omit<OldContactLenses, 'id'>, layoutInstanceId: number) { return this._createExamData<OldContactLenses>('old-contact-lenses', data, layoutInstanceId); }
  async getOldContactLenses(layoutInstanceId: number) { return this._getExamData<OldContactLenses>('old-contact-lenses', layoutInstanceId); }
  async updateOldContactLenses(id: number, data: Partial<OldContactLenses>) { return this._updateExamData<OldContactLenses>('old-contact-lenses', id, data); }

  async createOverRefraction(data: Omit<OverRefraction, 'id'>, layoutInstanceId: number) { return this._createExamData<OverRefraction>('over-refraction', data, layoutInstanceId); }
  async getOverRefraction(layoutInstanceId: number) { return this._getExamData<OverRefraction>('over-refraction', layoutInstanceId); }
  async updateOverRefraction(id: number, data: Partial<OverRefraction>) { return this._updateExamData<OverRefraction>('over-refraction', id, data); }

  async createSensationVisionStabilityExam(data: Omit<SensationVisionStabilityExam, 'id'>, layoutInstanceId: number) { return this._createExamData<SensationVisionStabilityExam>('sensation-vision-stability', data, layoutInstanceId); }
  async getSensationVisionStabilityExam(layoutInstanceId: number) { return this._getExamData<SensationVisionStabilityExam>('sensation-vision-stability', layoutInstanceId); }
  async updateSensationVisionStabilityExam(id: number, data: Partial<SensationVisionStabilityExam>) { return this._updateExamData<SensationVisionStabilityExam>('sensation-vision-stability', id, data); }
  
  async createDiopterAdjustmentPanel(data: Omit<DiopterAdjustmentPanel, 'id'>, layoutInstanceId: number) { return this._createExamData<DiopterAdjustmentPanel>('diopter-adjustment-panel', data, layoutInstanceId); }
  async getDiopterAdjustmentPanel(layoutInstanceId: number) { return this._getExamData<DiopterAdjustmentPanel>('diopter-adjustment-panel', layoutInstanceId); }
  async updateDiopterAdjustmentPanel(id: number, data: Partial<DiopterAdjustmentPanel>) { return this._updateExamData<DiopterAdjustmentPanel>('diopter-adjustment-panel', id, data); }
  
  async createFusionRangeExam(data: Omit<FusionRangeExam, 'id'>, layoutInstanceId: number) { return this._createExamData<FusionRangeExam>('fusion-range', data, layoutInstanceId); }
  async getFusionRangeExam(layoutInstanceId: number) { return this._getExamData<FusionRangeExam>('fusion-range', layoutInstanceId); }
  async updateFusionRangeExam(id: number, data: Partial<FusionRangeExam>) { return this._updateExamData<FusionRangeExam>('fusion-range', id, data); }
  
  async createMaddoxRodExam(data: Omit<MaddoxRodExam, 'id'>, layoutInstanceId: number) { return this._createExamData<MaddoxRodExam>('maddox-rod', data, layoutInstanceId); }
  async getMaddoxRodExam(layoutInstanceId: number) { return this._getExamData<MaddoxRodExam>('maddox-rod', layoutInstanceId); }
  async updateMaddoxRodExam(id: number, data: Partial<MaddoxRodExam>) { return this._updateExamData<MaddoxRodExam>('maddox-rod', id, data); }

  async createStereoTestExam(data: Omit<StereoTestExam, 'id'>, layoutInstanceId: number) { return this._createExamData<StereoTestExam>('stereo-test', data, layoutInstanceId); }
  async getStereoTestExam(layoutInstanceId: number) { return this._getExamData<StereoTestExam>('stereo-test', layoutInstanceId); }
  async updateStereoTestExam(id: number, data: Partial<StereoTestExam>) { return this._updateExamData<StereoTestExam>('stereo-test', id, data); }

  async createRGExam(data: Omit<RGExam, 'id'>, layoutInstanceId: number) { return this._createExamData<RGExam>('rg', data, layoutInstanceId); }
  async getRGExam(layoutInstanceId: number) { return this._getExamData<RGExam>('rg', layoutInstanceId); }
  async updateRGExam(id: number, data: Partial<RGExam>) { return this._updateExamData<RGExam>('rg', id, data); }

  async createOcularMotorAssessmentExam(data: Omit<OcularMotorAssessmentExam, 'id'>, layoutInstanceId: number) { return this._createExamData<OcularMotorAssessmentExam>('ocular-motor-assessment', data, layoutInstanceId); }
  async getOcularMotorAssessmentExam(layoutInstanceId: number) { return this._getExamData<OcularMotorAssessmentExam>('ocular-motor-assessment', layoutInstanceId); }
  async updateOcularMotorAssessmentExam(id: number, data: Partial<OcularMotorAssessmentExam>) { return this._updateExamData<OcularMotorAssessmentExam>('ocular-motor-assessment', id, data); }

  // Legacy methods for backward compatibility
  async createExamData(examType: string, data: any) {
    return this.request(`/exam-data/${examType}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getExamData(examType: string, layoutInstanceId: number) {
    return this.request(`/exam-data/${examType}/${layoutInstanceId}`);
  }

  async updateExamData(examType: string, id: number, data: any) {
    return this.request(`/exam-data/${examType}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteExamData(examType: string, id: number) {
    return this.request(`/exam-data/${examType}/${id}`, {
      method: 'DELETE',
    });
  }

  // Unified Exam Data API - replaces all individual exam component methods
  async getUnifiedExamData(layoutInstanceId: number) {
    return this.request(`/unified-exam-data/${layoutInstanceId}`);
  }

  async saveUnifiedExamData(layoutInstanceId: number, data: Record<string, any>) {
    return this.request(`/unified-exam-data/${layoutInstanceId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteUnifiedExamData(layoutInstanceId: number) {
    return this.request(`/unified-exam-data/${layoutInstanceId}`, {
      method: 'DELETE',
    });
  }

  async getUnifiedExamComponentData(layoutInstanceId: number, componentType: string) {
    return this.request(`/unified-exam-data/${layoutInstanceId}/${componentType}`);
  }

  async saveUnifiedExamComponentData(layoutInstanceId: number, componentType: string, data: Record<string, any>) {
    return this.request(`/unified-exam-data/${layoutInstanceId}/${componentType}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Legacy methods for backward compatibility


  // OpenAI Chat
  async chatCompletions(request: any) {
    return this.request('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // Email operations
  async emailTestConnection() {
    return this.request('/email/test-connection', {
      method: 'POST',
    });
  }

  async emailSendTestReminder(appointmentId: number) {
    return this.request(`/email/send-test-reminder/${appointmentId}`, {
      method: 'POST',
    });
  }

  async emailSchedulerStatus() {
    return this.request('/email/scheduler/status');
  }

  async emailSchedulerRestart() {
    return this.request('/email/scheduler/restart', {
      method: 'POST',
    });
  }

  // Campaign operations
  async campaignSchedulerStatus() {
    return this.request('/campaigns/scheduler/status');
  }

  async campaignSchedulerRestart() {
    return this.request('/campaigns/scheduler/restart', {
      method: 'POST',
    });
  }

  async campaignExecuteTest(campaignId: number) {
    return this.request(`/campaigns/${campaignId}/execute-test`, {
      method: 'POST',
    });
  }

  async campaignExecuteFull(campaignId: number) {
    return this.request(`/campaigns/${campaignId}/execute-full`, {
      method: 'POST',
    });
  }

  async campaignGetTargetClients(campaignId: number) {
    return this.request(`/campaigns/${campaignId}/target-clients`);
  }

  async campaignValidate(campaignId: number) {
    return this.request(`/campaigns/${campaignId}/validate`);
  }

  // Google operations
  async googleOAuthAuthenticate() {
    return this.request('/google/oauth/authenticate', {
      method: 'POST',
    });
  }

  async googleOAuthRefreshToken(refreshToken: string) {
    return this.request('/google/oauth/refresh-token', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async googleOAuthValidateTokens(tokens: any) {
    return this.request('/google/oauth/validate-tokens', {
      method: 'POST',
      body: JSON.stringify(tokens),
    });
  }

  async googleCalendarCreateEvent(tokens: any, appointment: any, client?: any) {
    return this.request('/google/calendar/create-event', {
      method: 'POST',
      body: JSON.stringify({ tokens, appointment, client }),
    });
  }

  async googleCalendarUpdateEvent(tokens: any, eventId: string, appointment: any, client?: any) {
    return this.request(`/google/calendar/update-event/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify({ tokens, appointment, client }),
    });
  }

  async googleCalendarDeleteEvent(tokens: any, eventId: string) {
    return this.request(`/google/calendar/delete-event/${eventId}`, {
      method: 'DELETE',
      body: JSON.stringify({ tokens }),
    });
  }

  async googleCalendarSyncAppointments(tokens: any, appointments: any[]) {
    return this.request('/google/calendar/sync-appointments', {
      method: 'POST',
      body: JSON.stringify({ tokens, appointments }),
    });
  }

  async googleCalendarGetEvents(tokens: any, startDate: string, endDate: string) {
    return this.request('/google/calendar/get-events', {
      method: 'POST',
      body: JSON.stringify({ tokens, startDate, endDate }),
    });
  }

  // AI operations
  async aiInitialize() {
    return this.request('/ai/initialize', {
      method: 'POST',
    });
  }

  async aiChat(message: string, conversationHistory: any[]) {
    return this.request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversationHistory }),
    });
  }

  async aiExecuteAction(action: string, data: any) {
    return this.request('/ai/execute-action', {
      method: 'POST',
      body: JSON.stringify({ action, data }),
    });
  }

  async aiGenerateMainState(clientId: number) {
    return this.request(`/ai/generate-main-state/${clientId}`, {
      method: 'POST',
    });
  }

  async aiGeneratePartState(clientId: number, part: string) {
    return this.request(`/ai/generate-part-state/${clientId}/${part}`, {
      method: 'POST',
    });
  }

  async aiGenerateAllStates(clientId: number) {
    return this.request(`/ai/generate-all-states/${clientId}`, {
      method: 'POST',
    });
  }

  async aiCreateCampaignFromPrompt(prompt: string) {
    return this.request('/ai/create-campaign-from-prompt', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  }

  async deleteCoverTestExam(id: number) {
    const response = await this.request(`/exam-data/cover-test/${id}`, {
      method: 'DELETE',
    });
    return response;
  }

  async deleteCornealTopographyExam(id: number) {
    const response = await this.request(`/exam-data/corneal-topography/${id}`, {
      method: 'DELETE',
    });
    return response;
  }

  // Batch API methods for loading and saving all exam data at once
  async getAllExamData(layoutInstanceId: number) {
    return this.request(`/exam-data/batch/${layoutInstanceId}`);
  }

  async saveAllExamData(layoutInstanceId: number, examData: Record<string, any>) {
    return this.request(`/exam-data/batch/${layoutInstanceId}`, {
      method: 'POST',
      body: JSON.stringify({
        layout_instance_id: layoutInstanceId,
        exam_data: examData
      }),
    });
  }
}

export const apiClient = new ApiClient(); 