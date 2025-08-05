import { httpClient } from './http-client';
import { ElectronAPI } from '../../types/electron';
import { apiClient } from '../api-client';

export type ConnectionMode = 'local' | 'remote';

class ConnectionManager {
  private mode: ConnectionMode = 'local';
  private serverUrl: string | null = null;
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    let savedMode: ConnectionMode = 'local';
    let savedServerUrl: string | null = null;
    if (typeof localStorage !== 'undefined') {
      savedMode = localStorage.getItem('opticai-connection-mode') as ConnectionMode;
      savedServerUrl = localStorage.getItem('opticai-server-url');
    }

    if (savedMode === 'remote' && savedServerUrl) {
      this.serverUrl = savedServerUrl;
      httpClient.setServerUrl(savedServerUrl);
      
      const isConnected = await httpClient.testConnection();
      if (isConnected) {
        this.mode = 'remote';
        console.log('✅ Connected to remote server:', savedServerUrl);
      } else {
        console.log('❌ Remote server not reachable, falling back to local mode');
        this.mode = 'local';
      }
    }

    this.isInitialized = true;
  }

  async setRemoteMode(serverUrl: string): Promise<boolean> {
    httpClient.setServerUrl(serverUrl);
    
    const isConnected = await httpClient.testConnection();
    if (isConnected) {
      this.mode = 'remote';
      this.serverUrl = serverUrl;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('opticai-connection-mode', 'remote');
        localStorage.setItem('opticai-server-url', serverUrl);
      }
      console.log('✅ Switched to remote mode:', serverUrl);
      return true;
    } else {
      console.log('❌ Failed to connect to server:', serverUrl);
      return false;
    }
  }

  setLocalMode(): void {
    this.mode = 'local';
    this.serverUrl = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('opticai-connection-mode', 'local');
      localStorage.removeItem('opticai-server-url');
    }
    console.log('✅ Switched to local mode');
  }

  getMode(): ConnectionMode {
    return this.mode;
  }

  getServerUrl(): string | null {
    return this.serverUrl;
  }

  isRemoteMode(): boolean {
    return this.mode === 'remote';
  }

  isLocalMode(): boolean {
    return this.mode === 'local';
  }

  async scanForServers(): Promise<string[]> {
    return httpClient.scanForServers();
  }

  async testConnection(url?: string): Promise<boolean> {
    if (url) {
      const tempClient = new (httpClient.constructor as any)(url);
      return tempClient.testConnection();
    }
    
    if (this.mode === 'remote') {
      return httpClient.testConnection();
    }
    
    return true;
  }

  protected async execute<T>(
    operationName: keyof ElectronAPI | keyof typeof httpClient,
    ...args: any[]
  ): Promise<T> {
    await this.initialize();
    
    if (this.mode === 'local') {
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }
      return window.electronAPI.db(operationName as string, ...args);
    } else {
      if (!this.serverUrl) {
        throw new Error('No server URL configured');
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (typeof httpClient[operationName] === 'function') {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return httpClient[operationName](...args);
      }
      throw new Error(`Remote operation ${String(operationName)} not found`);
    }
  }

  async authenticateUser(username: string, password?: string): Promise<any> {
    if (this.isRemoteMode()) {
      return httpClient.authenticateUser(username, password);
  }
    // For local mode, authentication is handled by a specific IPC call, not the generic DB one.
    return window.electronAPI.db('authenticateUser', username, password);
  }

  getConnectionStatus(): {
    mode: ConnectionMode;
    serverUrl: string | null;
    isConnected: boolean;
  } {
    return {
      mode: this.mode,
      serverUrl: this.serverUrl,
      isConnected: this.mode === 'local' || !!this.serverUrl
    };
  }
}

class DynamicConnectionManager extends ConnectionManager {
  constructor() {
    super();
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (prop in target) {
          return Reflect.get(target, prop, receiver);
        }

        // Dynamically create a method that calls through apiClient
        return async (...args: any[]) => {
          // Map old method names to apiClient methods
          const methodMap: { [key: string]: string } = {
            'getAllClients': 'getAllClients',
            'getClientById': 'getClientById',
            'createClient': 'createClient',
            'updateClient': 'updateClient',
            'deleteClient': 'deleteClient',
            'getAllExams': 'getAllExams',
            'getExamById': 'getExam',
            'createExam': 'createExam',
            'updateExam': 'updateExam',
            'deleteExam': 'deleteExam',
            'getAllUsers': 'getUsers',
            'getUserById': 'getUser',
            'createUser': 'createUser',
            'updateUser': 'updateUser',
            'deleteUser': 'deleteUser',
            'authenticateUser': 'authenticateUser',
            'getAllAppointments': 'getAllAppointments',
            'getAppointmentById': 'getAppointmentById',
            'createAppointment': 'createAppointment',
            'updateAppointment': 'updateAppointment',
            'deleteAppointment': 'deleteAppointment',
            'getAllCampaigns': 'getAllCampaigns',
            'getCampaignById': 'getCampaignById',
            'createCampaign': 'createCampaign',
            'updateCampaign': 'updateCampaign',
            'deleteCampaign': 'deleteCampaign',
            'getSettings': 'getSettings',
            'updateSettings': 'updateSettings',
            'getAllClientDataForAi': 'getAllClientDataForAi',
            'updateClientAiStates': 'updateClientAiStates',
            'updateClientAiPartState': 'updateClientAiPartState',
            'getClinicsByCompanyId': 'getClinicsByCompany',
            'getAppointmentsByUserId': 'getAppointmentsByUser',
            'createMedicalLog': 'createMedicalLog',
            'updateMedicalLog': 'updateMedicalLog',
            'deleteMedicalLog': 'deleteMedicalLog',
            'getMedicalLogsByClient': 'getMedicalLogsByClient',
            'getAllMedicalLogs': 'getMedicalLogs',
            'getMedicalLogById': 'getMedicalLog',
            'createFile': 'createFile',
            'updateFile': 'updateFile',
            'deleteFile': 'deleteFile',
            'getFilesByClient': 'getFilesByClient',
            'getAllFiles': 'getFiles',
            'getFileById': 'getFile',
            'createOrder': 'createOrder',
            'updateOrder': 'updateOrder',
            'deleteOrder': 'deleteOrder',
            'getOrdersByClient': 'getOrdersByClient',
            'getAllOrders': 'getAllOrders',
            'getOrderById': 'getOrder',
            'createFamily': 'createFamily',
            'updateFamily': 'updateFamily',
            'deleteFamily': 'deleteFamily',
            'getAllFamilies': 'getFamilies',
            'getFamilyById': 'getFamily',
            'getFamilyMembers': 'getFamilyMembers',
            'addClientToFamily': 'addClientToFamily',
            'removeClientFromFamily': 'removeClientFromFamily',
            'createWorkShift': 'createWorkShift',
            'updateWorkShift': 'updateWorkShift',
            'deleteWorkShift': 'deleteWorkShift',
            'getWorkShiftById': 'getWorkShift',
            'getWorkShiftsByUserId': 'getWorkShifts',
            'getActiveWorkShiftByUserId': 'getActiveWorkShift',
            'getWorkShiftsByUserAndMonth': 'getWorkShiftsByUserAndMonth',
            'getWorkShiftsByUserAndDate': 'getWorkShiftsByUserAndDate',
            'getWorkShiftStats': 'getWorkShiftStats',
            'createAnamnesisExam': 'createExamData',
            'getAnamnesisExamById': 'getExamData',
            'updateAnamnesisExam': 'updateExamData',
            'deleteAnamnesisExam': 'deleteExamData',
            'getAnamnesisExamByLayoutInstanceId': 'getExamData',
            'createCoverTestExam': 'createExamData',
            'getCoverTestExamById': 'getExamData',
            'updateCoverTestExam': 'updateExamData',
            'deleteCoverTestExam': 'deleteExamData',
            'getCoverTestExamByLayoutInstanceId': 'getExamData',
            'getAllCoverTestExamsByLayoutInstanceId': 'getExamData',
            'createSchirmerTestExam': 'createExamData',
            'getSchirmerTestExamById': 'getExamData',
            'updateSchirmerTestExam': 'updateExamData',
            'getSchirmerTestExamByLayoutInstanceId': 'getExamData',
            'createRGExam': 'createExamData',
            'getRGExamByLayoutInstanceId': 'getExamData',
            'updateRGExam': 'updateExamData',
            'createMaddoxRodExam': 'createExamData',
            'getMaddoxRodExamByLayoutInstanceId': 'getExamData',
            'updateMaddoxRodExam': 'updateExamData',
            'createStereoTestExam': 'createExamData',
            'getStereoTestExamByLayoutInstanceId': 'getExamData',
            'updateStereoTestExam': 'updateExamData',
            'createOcularMotorAssessmentExam': 'createExamData',
            'getOcularMotorAssessmentExamByLayoutInstanceId': 'getExamData',
            'updateOcularMotorAssessmentExam': 'updateExamData',
            'createOverRefraction': 'createExamData',
            'getOverRefraction': 'getExamData',
            'updateOverRefraction': 'updateExamData',
            'deleteOverRefraction': 'deleteExamData',
            'getOverRefractionByLayoutInstanceId': 'getExamData',
            'createOldRefExam': 'createExamData',
            'getOldRefExamByLayoutInstanceId': 'getExamData',
            'updateOldRefExam': 'updateExamData',
            'createOldContactLenses': 'createExamData',
            'getOldContactLensesById': 'getExamData',
            'updateOldContactLenses': 'updateExamData',
            'getOldContactLensesByLayoutInstanceId': 'getExamData',
            'createCompactPrescriptionExam': 'createExamData',
            'getCompactPrescriptionExamById': 'getExamData',
            'updateCompactPrescriptionExam': 'updateExamData',
            'deleteCompactPrescriptionExam': 'deleteExamData',
            'getCompactPrescriptionExamByReferralId': 'getExamData',
            'getCompactPrescriptionExamByLayoutInstanceId': 'getExamData',
            'createNotesExam': 'createExamData',
            'updateNotesExam': 'updateExamData',
            'deleteNotesExam': 'deleteExamData',
            'getNotesExamById': 'getExamData',
            'getNotesExamByLayoutInstanceId': 'getExamData',
            'getAllNotesExamsByLayoutInstanceId': 'getExamData',
            'createDiopterAdjustmentPanel': 'createExamData',
            'getDiopterAdjustmentPanelByLayoutInstanceId': 'getExamData',
            'updateDiopterAdjustmentPanel': 'updateExamData',
            'getCampaignClientExecution': 'getCampaignClientExecution',
            'addCampaignClientExecution': 'addCampaignClientExecution'
          };

          const apiMethod = methodMap[prop as string];
          if (apiMethod) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            return await apiClient[apiMethod](...args);
          }

          throw new Error(`Method ${String(prop)} not found in apiClient`);
        };
      }
    });
  }
}

export const connectionManager: DynamicConnectionManager = new DynamicConnectionManager();
export default connectionManager; 