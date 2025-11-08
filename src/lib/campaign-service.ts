import { Campaign, Client, Appointment, OpticalExam, Order } from './db/schema-interface';
import { getCampaignClientExecution, addCampaignClientExecution } from './db/campaigns-db';
import { apiClient } from './api-client';

export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
  logic?: 'AND' | 'OR';
}

export class CampaignService {
  async getFilteredClients(campaign: Campaign): Promise<Client[]> {
    try {
      const filters: FilterCondition[] = JSON.parse(campaign.filters || '[]');
      if (filters.length === 0) {
        return [];
      }

      const allClientsResponse = await apiClient.getAllClients();
      const allClients = allClientsResponse.data || [];
      const allAppointmentsResponse = await apiClient.getAllAppointments();
      const allAppointments = allAppointmentsResponse.data || [];
      const allExamsResponse = await apiClient.getAllExams();
      const allExams = allExamsResponse.data || [];
      const allOrdersResponse = await apiClient.getAllOrders();
      const allOrders = allOrdersResponse.data || [];

      let filteredClients = allClients.filter(client => {
        return this.evaluateClientFilters(client, filters, allAppointments, allExams, allOrders);
      });

      if (campaign.execute_once_per_client) {
        const filteredClientsWithNulls = await Promise.all(filteredClients.map(async client => {
          const alreadyExecuted = await getCampaignClientExecution(campaign.id!, client.id! );
          return alreadyExecuted ? null : client;
        }));
        filteredClients = filteredClientsWithNulls.filter(Boolean) as Client[];
      }

      return filteredClients;
    } catch (error) {
      console.error('Error filtering clients for campaign:', error);
      return [];
    }
  }

  private evaluateClientFilters(
    client: Client,
    filters: FilterCondition[],
    allAppointments: Appointment[],
    allExams: OpticalExam[],
    allOrders: Order[]
  ): boolean {
    if (filters.length === 0) return true;

    const clientAppointments = allAppointments.filter(a => a.client_id === client.id);
    const clientExams = allExams.filter(e => e.client_id === client.id);
    const clientOrders = allOrders.filter(o => o.client_id === client.id);

    let result = this.evaluateFilter(filters[0], client, clientAppointments, clientExams, clientOrders);

    for (let i = 1; i < filters.length; i++) {
      const filter = filters[i];
      const filterResult = this.evaluateFilter(filter, client, clientAppointments, clientExams, clientOrders);
      
      if (filter.logic === 'OR') {
        result = result || filterResult;
      } else {
        result = result && filterResult;
      }
    }

    return result;
  }

  private evaluateFilter(
    filter: FilterCondition,
    client: Client,
    clientAppointments: Appointment[],
    clientExams: OpticalExam[],
    clientOrders: Order[]
  ): boolean {
    const field = filter.field;
    const operator = filter.operator;
    const value = filter.value;

    let clientValue: any;

    switch (field) {
      case 'first_name':
        clientValue = client.first_name || '';
        break;
      case 'last_name':
        clientValue = client.last_name || '';
        break;
      case 'gender':
        clientValue = client.gender || '';
        break;
      case 'age':
        clientValue = this.calculateAge(client.date_of_birth);
        break;
      case 'date_of_birth':
        clientValue = client.date_of_birth || '';
        break;
      case 'national_id':
        clientValue = client.national_id || '';
        break;
      case 'health_fund':
        clientValue = client.health_fund || '';
        break;
      case 'phone_mobile':
        clientValue = client.phone_mobile || '';
        break;
      case 'email':
        clientValue = client.email || '';
        break;
      case 'address_city':
        clientValue = client.address_city || '';
        break;
      case 'has_family':
        clientValue = !!client.family_id;
        break;
      case 'family_role':
        clientValue = client.family_role || '';
        break;
      case 'status':
        clientValue = client.status || '';
        break;
      case 'blocked_checks':
        clientValue = !!client.blocked_checks;
        break;
      case 'blocked_credit':
        clientValue = !!client.blocked_credit;
        break;
      case 'discount_percent':
        clientValue = client.discount_percent || 0;
        break;
      case 'file_creation_date':
        clientValue = client.file_creation_date || '';
        break;
      case 'membership_end':
        clientValue = client.membership_end || '';
        break;
      case 'service_end':
        clientValue = client.service_end || '';
        break;
      case 'last_exam_days':
        clientValue = this.getDaysSinceLastExam(clientExams);
        break;
      case 'last_order_days':
        clientValue = this.getDaysSinceLastOrder(clientOrders);
        break;
      case 'last_appointment_days':
        clientValue = this.getDaysSinceLastAppointment(clientAppointments);
        break;
      case 'has_appointments':
        clientValue = clientAppointments.length > 0;
        break;
      case 'has_exams':
        clientValue = clientExams.length > 0;
        break;
      case 'has_orders':
        clientValue = clientOrders.length > 0;
        break;
      case 'total_orders':
        clientValue = clientOrders.length;
        break;
      case 'total_exams':
        clientValue = clientExams.length;
        break;
      default:
        return false;
    }

    return this.evaluateCondition(clientValue, operator, value);
  }

  private evaluateCondition(clientValue: any, operator: string, filterValue: string): boolean {
    switch (operator) {
      case 'equals':
        return String(clientValue) === filterValue;
      case 'not_equals':
        return String(clientValue) !== filterValue;
      case 'contains':
        return String(clientValue).toLowerCase().includes(filterValue.toLowerCase());
      case 'not_contains':
        return !String(clientValue).toLowerCase().includes(filterValue.toLowerCase());
      case 'starts_with':
        return String(clientValue).toLowerCase().startsWith(filterValue.toLowerCase());
      case 'ends_with':
        return String(clientValue).toLowerCase().endsWith(filterValue.toLowerCase());
      case 'is_empty':
        return !clientValue || String(clientValue).trim() === '';
      case 'is_not_empty':
        return !!clientValue && String(clientValue).trim() !== '';
      case 'greater_than':
        return Number(clientValue) > Number(filterValue);
      case 'less_than':
        return Number(clientValue) < Number(filterValue);
      case 'greater_equal':
        return Number(clientValue) >= Number(filterValue);
      case 'less_equal':
        return Number(clientValue) <= Number(filterValue);
      case 'after':
        return new Date(clientValue) > new Date(filterValue);
      case 'before':
        return new Date(clientValue) < new Date(filterValue);
      case 'last_days':
        if (typeof clientValue === 'number') {
          return clientValue <= Number(filterValue);
        }
        return false;
      case 'next_days':
        if (typeof clientValue === 'number') {
          return clientValue >= -Number(filterValue);
        }
        return false;
      default:
        return false;
    }
  }

  private calculateAge(dateOfBirth?: string): number {
    if (!dateOfBirth) return 0;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  private getDaysSinceLastExam(exams: OpticalExam[]): number {
    if (exams.length === 0) return -1;
    
    const sortedExams = exams.sort((a, b) => 
      new Date(b.exam_date || '').getTime() - new Date(a.exam_date || '').getTime()
    );
    
    const lastExamDate = new Date(sortedExams[0].exam_date || '');
    const today = new Date();
    const timeDiff = today.getTime() - lastExamDate.getTime();
    
    return Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  }

  private getDaysSinceLastOrder(orders: Order[]): number {
    if (orders.length === 0) return -1;
    
    const sortedOrders = orders.sort((a, b) => 
      new Date(b.order_date || '').getTime() - new Date(a.order_date || '').getTime()
    );
    
    const lastOrderDate = new Date(sortedOrders[0].order_date || '');
    const today = new Date();
    const timeDiff = today.getTime() - lastOrderDate.getTime();
    
    return Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  }

  private getDaysSinceLastAppointment(appointments: Appointment[]): number {
    if (appointments.length === 0) return -1;
    
    const sortedAppointments = appointments.sort((a, b) => 
      new Date(b.date || '').getTime() - new Date(a.date || '').getTime()
    );
    
    const lastAppointmentDate = new Date(sortedAppointments[0].date || '');
    const today = new Date();
    const timeDiff = today.getTime() - lastAppointmentDate.getTime();
    
    return Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  }

  async getTargetClientsForCampaign(campaignId: number): Promise<Client[]> {
    try {
      const campaignResponse = await apiClient.getCampaignById(campaignId);
      const campaign = campaignResponse.data;
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      return await this.getFilteredClients(campaign);
    } catch (error) {
      console.error('Error getting target clients for campaign:', error);
      return [];
    }
  }

  async validateCampaignForExecution(campaign: Campaign): Promise<{
    valid: boolean;
    errors: string[];
    targetCount: number;
  }> {
    const errors: string[] = [];
    
    if (!campaign.active) {
      errors.push('Campaign is not active');
    }
    
    if (!campaign.email_enabled && !campaign.sms_enabled) {
      errors.push('No communication method enabled');
    }
    
    if (campaign.email_enabled && !campaign.email_content?.trim()) {
      errors.push('Email content is empty');
    }
    
    if (campaign.sms_enabled && !campaign.sms_content?.trim()) {
      errors.push('SMS content is empty');
    }
    
    // Check email settings if email is enabled
    if (campaign.email_enabled) {
      const settingsResponse = await apiClient.getSettings(campaign.clinic_id);
      const settings = settingsResponse.data;
      if (!settings) {
        errors.push('Email settings not found');
      } else if (!settings.email_username || !settings.email_password) {
        errors.push('Email settings not configured. Please configure email settings in the Settings page.');
      }
    }
    
    const targetClients = await this.getFilteredClients(campaign);
    
    if (targetClients.length === 0) {
      errors.push('No target clients found matching the filters');
    }
    
    if (campaign.email_enabled) {
      const clientsWithEmail = targetClients.filter(client => client.email && client.email.trim() !== '');
      if (clientsWithEmail.length === 0) {
        errors.push('No target clients have email addresses');
      }
    }
    
    if (campaign.sms_enabled) {
      const clientsWithPhone = targetClients.filter(client => client.phone_mobile && client.phone_mobile.trim() !== '');
      if (clientsWithPhone.length === 0) {
        errors.push('No target clients have phone numbers');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      targetCount: targetClients.length
    };
  }
}

export const campaignService = new CampaignService(); 