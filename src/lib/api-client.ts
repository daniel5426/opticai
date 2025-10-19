import { 
  User, Company, Clinic, Client, Family, Settings, OpticalExam, Appointment, 
  File, MedicalLog, Order, Billing, ExamLayout, ExamLayoutInstance,
  LookupSupplier, LookupClinic, LookupOrderType, LookupReferralType,
  LookupLensModel, LookupColor, LookupMaterial, LookupCoating,
  LookupManufacturer, LookupFrameModel, LookupContactLensType,
  LookupContactEyeLensType, LookupContactEyeMaterial, LookupCleaningSolution,
  LookupDisinfectionSolution, LookupRinsingSolution, LookupManufacturingLab,
  LookupAdvisor, Referral, ReferralEye, OrderLineItem,
  ContactLensOrderEntity, ContactLensDiameters, ContactLensDetails,
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
import { getSupabaseAccessToken } from './supabaseClient'

const API_BASE_URL = 'http://localhost:8001/api/v1';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private isRefreshingToken: boolean = false;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    if (typeof localStorage !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  private decodeJwt(token: string): any | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(payload));
      return decoded;
    } catch {
      return null;
    }
  }

  private isTokenExpiringSoon(token: string, bufferSeconds: number = 60): boolean {
    const payload = this.decodeJwt(token);
    if (!payload?.exp) return false;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= now + bufferSeconds;
  }

  private async refreshTokenIfPossible(): Promise<void> {
    if (this.isRefreshingToken) return;
    this.isRefreshingToken = true;
    try {
      const cu = typeof localStorage !== 'undefined' ? localStorage.getItem('currentUser') : null;
      if (!cu) return;
      const parsed = JSON.parse(cu);
      const hasPassword = typeof parsed?.has_password === 'boolean' ? parsed.has_password : !!(parsed?.password && String(parsed.password).trim() !== '');
      const canNoPasswordLogin = parsed?.username && !hasPassword;
      if (!canNoPasswordLogin) return;
      const url = `${this.baseUrl}/auth/login-no-password`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: parsed.username })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.access_token) {
          this.setToken(data.access_token);
        }
      }
    } catch {}
    finally {
      this.isRefreshingToken = false;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };
    if (!isFormData) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    const isPublicEndpoint = endpoint.includes('/public') || endpoint.startsWith('/auth/login-no-password') || endpoint.startsWith('/auth/login');
    let effectiveToken = this.token;
    if (!isPublicEndpoint) {
      if (!effectiveToken) {
        // Only try to get Supabase token if we're not in a clinic context
        const isInClinicContext = typeof localStorage !== 'undefined' && localStorage.getItem('selectedClinic');
        if (!isInClinicContext) {
          const supabaseToken = await getSupabaseAccessToken();
          effectiveToken = supabaseToken || null;
        }
      }
      if (effectiveToken) {
        headers['Authorization'] = `Bearer ${effectiveToken}`;
      }
    }

    try {
      const fetchOptions: RequestInit = {
        ...options,
        headers,
        cache: (options as any)?.cache ?? 'no-store',
      };
      let response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          const hadAuthHeader = Boolean(headers['Authorization']);
          if (hadAuthHeader && !isPublicEndpoint) {
            this.clearToken();
            try {
              if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('currentUser');
                localStorage.removeItem('currentUserId');
                localStorage.removeItem('selectedClinic');
              }
            } catch {}
            try {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth:unauthorized'));
              }
            } catch {}
          }
        }
        const second = await response.json().catch(() => errorData);
        return { error: (second && (second as any).detail) || `HTTP ${response.status}` };
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

  async getCurrentUser() {
    return this.request('/auth/me');
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
    return this.request<Clinic>('/clinics/', {
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

  async getUsersForSelect(params?: { clinic_id?: number; include_ceo?: boolean }) {
    const u = new URLSearchParams()
    if (params?.clinic_id !== undefined) u.append('clinic_id', String(params.clinic_id))
    if (params?.include_ceo !== undefined) u.append('include_ceo', String(params.include_ceo))
    const qs = u.toString()
    return this.request<Array<Pick<User,'id'|'full_name'|'username'|'role'|'clinic_id'|'is_active'>>>('/users/select' + (qs ? `?${qs}` : ''))
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

  async getUserByEmailPublic(email: string) {
    return this.request<User>(`/users/email/${encodeURIComponent(email)}/public`);
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

  async getClientsPaginated(
    clinicId?: number,
    options?: { limit?: number; offset?: number; order?: 'id_desc' | 'id_asc'; search?: string }
  ) {
    const params = new URLSearchParams();
    if (clinicId) params.append('clinic_id', clinicId.toString());
    if (options?.limit !== undefined) params.append('limit', String(options.limit));
    if (options?.offset !== undefined) params.append('offset', String(options.offset));
    if (options?.order) params.append('order', options.order);
    if (options?.search) params.append('search', options.search);
    const qs = params.toString();
    return this.request<{ items: Client[]; total: number }>(`/clients/paginated${qs ? `?${qs}` : ''}`);
  }

  // Referrals pagination
  async getReferralsPaginated(clinicId?: number, options?: { limit?: number; offset?: number; order?: 'date_desc' | 'date_asc' | 'id_desc' | 'id_asc'; search?: string }) {
    const params = new URLSearchParams();
    if (clinicId) params.append('clinic_id', clinicId.toString());
    if (options?.limit !== undefined) params.append('limit', String(options.limit));
    if (options?.offset !== undefined) params.append('offset', String(options.offset));
    if (options?.order) params.append('order', options.order);
    if (options?.search) params.append('search', options.search);
    const qs = params.toString();
    return this.request<{ items: any[]; total: number }>(`/referrals/paginated${qs ? `?${qs}` : ''}`);
  }

  // Orders pagination
  async getOrdersPaginated(clinicId?: number, options?: { limit?: number; offset?: number; order?: 'date_desc' | 'date_asc' | 'id_desc' | 'id_asc'; search?: string }) {
    const params = new URLSearchParams();
    if (clinicId) params.append('clinic_id', clinicId.toString());
    if (options?.limit !== undefined) params.append('limit', String(options.limit));
    if (options?.offset !== undefined) params.append('offset', String(options.offset));
    if (options?.order) params.append('order', options.order);
    if (options?.search) params.append('search', options.search);
    const qs = params.toString();
    return this.request<{ items: any[]; total: number }>(`/orders/paginated${qs ? `?${qs}` : ''}`);
  }

  // Files pagination
  async getFilesPaginated(clinicId?: number, options?: { limit?: number; offset?: number; order?: 'upload_date_desc' | 'upload_date_asc' | 'id_desc' | 'id_asc'; search?: string }) {
    const params = new URLSearchParams();
    if (clinicId) params.append('clinic_id', clinicId.toString());
    if (options?.limit !== undefined) params.append('limit', String(options.limit));
    if (options?.offset !== undefined) params.append('offset', String(options.offset));
    if (options?.order) params.append('order', options.order);
    if (options?.search) params.append('search', options.search);
    const qs = params.toString();
    return this.request<{ items: any[]; total: number }>(`/files/paginated${qs ? `?${qs}` : ''}`);
  }

  // Appointments pagination
  async getAppointmentsPaginated(clinicId?: number, options?: { limit?: number; offset?: number; order?: 'date_desc' | 'date_asc' | 'id_desc' | 'id_asc'; search?: string }) {
    const params = new URLSearchParams();
    if (clinicId) params.append('clinic_id', clinicId.toString());
    if (options?.limit !== undefined) params.append('limit', String(options.limit));
    if (options?.offset !== undefined) params.append('offset', String(options.offset));
    if (options?.order) params.append('order', options.order);
    if (options?.search) params.append('search', options.search);
    const qs = params.toString();
    return this.request<{ items: any[]; total: number }>(`/appointments/paginated${qs ? `?${qs}` : ''}`);
  }

  // Families pagination
  async getFamiliesPaginated(clinicId?: number, options?: { limit?: number; offset?: number; order?: 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc' | 'id_desc' | 'id_asc'; search?: string }) {
    const params = new URLSearchParams();
    if (clinicId) params.append('clinic_id', clinicId.toString());
    if (options?.limit !== undefined) params.append('limit', String(options.limit));
    if (options?.offset !== undefined) params.append('offset', String(options.offset));
    if (options?.order) params.append('order', options.order);
    if (options?.search) params.append('search', options.search);
    const qs = params.toString();
    return this.request<{ items: (Family & { clients?: Client[] })[]; total: number }>(`/families/paginated${qs ? `?${qs}` : ''}`);
  }

  // Users pagination
  async getUsersPaginated(options?: { limit?: number; offset?: number; order?: 'id_desc' | 'id_asc' | 'username_asc' | 'username_desc' | 'role_asc' | 'role_desc'; search?: string }) {
    const params = new URLSearchParams();
    if (options?.limit !== undefined) params.append('limit', String(options.limit));
    if (options?.offset !== undefined) params.append('offset', String(options.offset));
    if (options?.order) params.append('order', options.order);
    if (options?.search) params.append('search', options.search);
    const qs = params.toString();
    return this.request<{ items: any[]; total: number }>(`/users/paginated${qs ? `?${qs}` : ''}`);
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
    const url = `/clients/${clientId}/ai-part-state?part=${encodeURIComponent(part)}&ai_part_state=${encodeURIComponent(aiPartState)}`;
    return this.request(url, {
      method: 'PUT',
    });
  }

  async getAllClientDataForAi(clientId: number) {
    return this.request(`/clients/${clientId}/all-data-for-ai`);
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
    const params = new URLSearchParams({ client_id: String(clientId), role });
    return this.request(`/families/${familyId}/add-client?${params.toString()}`, {
      method: 'POST',
    });
  }

  async removeClientFromFamily(clientId: number, familyId: number) {
    return this.request(`/families/${familyId}/remove-client/${clientId}`, {
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

  async getEnrichedExams(type?: string, clinicId?: number, options?: { limit?: number; offset?: number; order?: 'exam_date_desc' | 'exam_date_asc'; search?: string }) {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (clinicId) params.append('clinic_id', clinicId.toString());
    if (options?.limit !== undefined) params.append('limit', String(options.limit));
    if (options?.offset !== undefined) params.append('offset', String(options.offset));
    if (options?.order) params.append('order', options.order);
    if (options?.search) params.append('search', options.search);
    const queryString = params.toString();
    const url = `/exams/enriched${queryString ? `?${queryString}` : ''}`;
    return this.request<{ items: any[]; total: number }>(url);
  }

  // Exam Layouts
  async getExamLayouts(clinicId?: number) {
    const params = new URLSearchParams();
    if (clinicId) params.append('clinic_id', clinicId.toString());
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

  async getCompanyAppointmentsStats(companyId: number) {
    return this.request(`/appointments/stats/company/${companyId}`);
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
    // Backend endpoint is /appointments/{id}/google-event-id and expects 'google_event_id'
    const param = googleEventId ? encodeURIComponent(googleEventId) : ''
    const url = `/appointments/${appointmentId}/google-event-id?google_event_id=${param}`
    return this.request(url, {
      method: 'PUT',
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

  async getFileDownloadUrl(id: number) {
    return this.request<{ url: string }>(`/files/${id}/download-url`);
  }

  async getFilesByClient(clientId: number) {
    return this.request<File[]>(`/files/client/${clientId}`);
  }

  async createFile(payload: any) {
    const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData;
    return this.request<File>('/files', {
      method: 'POST',
      body: isFormData ? payload : JSON.stringify(payload),
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

  async upsertOrderFull(payload: any) {
    return this.request(`/orders/upsert-full`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async deleteOrder(id: number) {
    return this.request(`/orders/${id}`, {
      method: 'DELETE',
    });
  }

  // Contact Lens Orders
  async getContactLensOrders(clinicId?: number) {
    const url = clinicId ? `/contact-lens-orders?clinic_id=${clinicId}` : '/contact-lens-orders';
    return this.request<ContactLensOrderEntity[]>(url);
  }

  async getContactLensOrder(id: number) {
    return this.request<ContactLensOrderEntity>(`/contact-lens-orders/${id}`);
  }

  async getContactLensOrdersByClient(clientId: number) {
    return this.request<ContactLensOrderEntity[]>(`/contact-lens-orders/client/${clientId}`);
  }

  async createContactLensOrder(order: any) {
    return this.request<ContactLensOrderEntity>('/contact-lens-orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  async updateContactLensOrder(id: number, order: any) {
    return this.request<ContactLensOrderEntity>(`/contact-lens-orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(order),
    });
  }

  async deleteContactLensOrder(id: number) {
    return this.request(`/contact-lens-orders/${id}`, {
      method: 'DELETE',
    });
  }

  async upsertContactLensOrderFull(payload: any) {
    return this.request(`/contact-lens-orders/upsert-full`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Order unified data
  async getOrderData(orderId: number) {
    return this.request(`/orders/${orderId}/data`);
  }

  async saveOrderData(orderId: number, data: Record<string, any>) {
    return this.request(`/orders/${orderId}/data`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getOrderComponentData(orderId: number, componentType: string) {
    return this.request(`/orders/${orderId}/data/component/${componentType}`);
  }

  async saveOrderComponentData(orderId: number, componentType: string, data: Record<string, any>) {
    return this.request(`/orders/${orderId}/data/component/${componentType}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Order Eyes
  

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

  // Referral unified data
  async getReferralData(referralId: number) {
    return this.request(`/referrals/${referralId}/data`);
  }

  async saveReferralData(referralId: number, data: Record<string, any>) {
    return this.request(`/referrals/${referralId}/data`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getReferralComponentData(referralId: number, componentType: string) {
    return this.request(`/referrals/${referralId}/data/component/${componentType}`);
  }

  async saveReferralComponentData(referralId: number, componentType: string, data: Record<string, any>) {
    return this.request(`/referrals/${referralId}/data/component/${componentType}`, {
      method: 'POST',
      body: JSON.stringify(data),
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
  async getChats(clinicId?: number, limit: number = 10, offset: number = 0, search?: string) {
    let url = `/chats?limit=${limit}&offset=${offset}`;
    if (clinicId) {
      url += `&clinic_id=${clinicId}`;
    }
    if (search && search.trim()) {
      url += `&search=${encodeURIComponent(search.trim())}`;
    }
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
    return this.request<ChatMessage[]>(`/chats/${chatId}/messages`);
  }

  async createChatMessage(messageData: { chat_id: number; type: string; content: string; data?: string }) {
    const { chat_id, ...payload } = messageData;
    return this.request<ChatMessage>(`/chats/${chat_id}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateChatMessage(chatId: number, id: number, chatMessage: any) {
    return this.request<ChatMessage>(`/chats/${chatId}/messages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(chatMessage),
    });
  }

  async deleteChatMessage(chatId: number, id: number) {
    return this.request(`/chats/${chatId}/messages/${id}`, {
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
    if (settings?.id) {
      return this.request<Settings>(`/settings/${settings.id}`, {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
    }
    return this.request<Settings>('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  async createSettings(settings: any) {
    return this.request<Settings>('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  async saveAll(payload: any) {
    return this.request('/settings/save-all', {
      method: 'POST',
      body: JSON.stringify(payload),
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

  async getCompanyNewClientsStats(companyId: number) {
    return this.request(`/clients/stats/company/${companyId}`);
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
    return this.request(`/lookups/${tableName}`);
  }

  async createLookupItem(tableName: string, item: any) {
    return this.request(`/lookups/${tableName}`, {
      method: 'POST',
      body: JSON.stringify(item),
    });
  }

  async updateLookupItem(tableName: string, id: number, item: any) {
    return this.request(`/lookups/${tableName}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(item),
    });
  }

  async deleteLookupItem(tableName: string, id: number) {
    return this.request(`/lookups/${tableName}/${id}`, {
      method: 'DELETE',
    });
  }

  // Specific lookup methods for backward compatibility
  async getLookupSuppliers() {
    return this.request<LookupSupplier[]>('/lookups/suppliers');
  }

  async createLookupSupplier(supplier: any) {
    return this.request<LookupSupplier>('/lookups/suppliers', {
      method: 'POST',
      body: JSON.stringify(supplier),
    });
  }

  async updateLookupSupplier(id: number, supplier: any) {
    return this.request<LookupSupplier>(`/lookups/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(supplier),
    });
  }

  async deleteLookupSupplier(id: number) {
    return this.request(`/lookups/suppliers/${id}`, {
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

  async getExamWithLayouts(examId: number) {
    return this.request(`/exams/${examId}/with-layouts`);
  }

  async getExamPageData(examId: number) {
    return this.request(`/exams/${examId}/page-data`);
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

  // Dashboard aggregated endpoint
  async getDashboardHome(clinicId: number, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    params.append('clinic_id', String(clinicId));
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const qs = params.toString();
    return this.request(`/dashboard/home?${qs}`);
  }

  // Unified search
  async unifiedSearch(query: string, clinicId?: number, options?: { limit?: number; offset?: number }) {
    const params = new URLSearchParams();
    params.append('q', query);
    if (clinicId) params.append('clinic_id', String(clinicId));
    if (options?.limit !== undefined) params.append('limit', String(options.limit));
    if (options?.offset !== undefined) params.append('offset', String(options.offset));
    const qs = params.toString();
    return this.request<{ items: Array<{ type: string; id: number; title: string; subtitle?: string; description?: string; client_id?: number }>; total: number }>(`/search?${qs}`);
  }

  // Control Center aggregated endpoints
  async getControlCenterDashboard(companyId: number) {
    return this.request(`/control-center/dashboard/${companyId}`);
  }

  async getControlCenterUsers(companyId: number) {
    return this.request(`/control-center/users/${companyId}`);
  }

  async getControlCenterClinics(companyId: number) {
    return this.request(`/control-center/clinics/${companyId}`);
  }

  async ccStatsUsersClientsPerClinic(companyId: number) {
    return this.request(`/control-center/stats/users-clients-per-clinic/${companyId}`);
  }

  async ccStatsAppointmentsMonthPerClinic(companyId: number) {
    return this.request(`/control-center/stats/appointments-month-per-clinic/${companyId}`);
  }

  async ccStatsNewClientsSeries(companyId: number, months: number = 12) {
    return this.request(`/control-center/stats/new-clients-series/${companyId}?months=${months}`);
  }

  async ccStatsAov(companyId: number, months: number = 3) {
    return this.request(`/control-center/stats/aov/${companyId}?months=${months}`);
  }

  async ccStatsOrdersByType(companyId: number, months: number = 6) {
    return this.request(`/control-center/stats/orders-by-type/${companyId}?months=${months}`);
  }

  async ccStatsTopSkus(companyId: number, months: number = 6, limit: number = 10) {
    return this.request(`/control-center/stats/top-skus/${companyId}?months=${months}&limit=${limit}`);
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

  async aiChat(message: string, conversationHistory: any[], chatId?: number) {
    return this.request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversationHistory, chat_id: chatId }),
    });
  }

  async aiChatStream(
    message: string,
    conversationHistory: any[],
    chatId: number | null,
    onChunk: (chunk: string, fullMessage: string, parts?: any[]) => void,
    onDone: (fullMessage: string, parts?: any[]) => void,
    onTool?: (evt: { phase: 'start'|'end'; name?: string; args?: any; output?: any; parts?: any[] }) => void
  ) {
    const url = `${this.baseUrl}/ai/chat/stream`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, conversationHistory, chat_id: chatId ?? undefined }),
    });
    if (!res.ok) throw new Error('stream request failed');
    const reader = res.body?.getReader();
    if (!reader) {
      onDone('', []);
      return;
    }
    const decoder = new TextDecoder();
    let buffer = '';
    let doneReceived = false;
    let lastFullMessage = '';
    let lastParts: any[] | undefined = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sepIndex;
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        const line = frame.trim();
        if (!line) continue;
        if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim();
          try {
            const payload = JSON.parse(dataStr);
            if (payload.tool && onTool) {
              const { phase, name, args, output } = payload.tool;
              onTool({ phase, name, args, output, parts: payload.parts });
              if (Array.isArray(payload.parts)) lastParts = payload.parts;
              continue;
            }
            if (payload.done) {
              doneReceived = true;
              lastFullMessage = payload.message || lastFullMessage || '';
              lastParts = Array.isArray(payload.parts) ? payload.parts : lastParts;
              onDone(lastFullMessage, lastParts);
            } else if (payload.currentTextPart !== undefined) {
              lastFullMessage = payload.fullMessage || lastFullMessage;
              onChunk(payload.chunk || '', lastFullMessage, payload.currentTextPart);
            } else {
              lastFullMessage = payload.fullMessage || lastFullMessage;
              lastParts = Array.isArray(payload.parts) ? payload.parts : lastParts;
              onChunk(payload.chunk || '', lastFullMessage, lastParts);
            }
          } catch {}
        }
      }
    }
    if (!doneReceived) {
      onDone(lastFullMessage || '', lastParts || []);
    }
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