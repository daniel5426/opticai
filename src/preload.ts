import { contextBridge, ipcRenderer } from 'electron';

// Expose theme functionality
contextBridge.exposeInMainWorld('themeMode', {
  current: () => ipcRenderer.invoke('theme-mode:current'),
  toggle: () => ipcRenderer.invoke('theme-mode:toggle'),
  dark: () => ipcRenderer.invoke('theme-mode:dark'),
  light: () => ipcRenderer.invoke('theme-mode:light'),
  system: () => ipcRenderer.invoke('theme-mode:system'),
});

// Expose window controls
contextBridge.exposeInMainWorld('electronWindow', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
});

// Expose APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Client operations
  getAllClients: () => ipcRenderer.invoke('db-get-all-clients'),
  getClient: (id: number) => ipcRenderer.invoke('db-get-client', id),
  createClient: (clientData: any) => ipcRenderer.invoke('db-create-client', clientData),
  updateClient: (clientData: any) => ipcRenderer.invoke('db-update-client', clientData),
  deleteClient: (id: number) => ipcRenderer.invoke('db-delete-client', id),

  // Exam operations
  getExamsByClientId: (clientId: number) => ipcRenderer.invoke('db-get-exams-by-client', clientId),
  getExamsByClient: (clientId: number) => ipcRenderer.invoke('db-get-exams-by-client', clientId),
  getAllExams: () => ipcRenderer.invoke('db-get-all-exams'),
  getExam: (id: number) => ipcRenderer.invoke('db-get-exam', id),
  getExamById: (id: number) => ipcRenderer.invoke('db-get-exam', id),
  createExam: (examData: any) => ipcRenderer.invoke('db-create-exam', examData),
  updateExam: (examData: any) => ipcRenderer.invoke('db-update-exam', examData),
  deleteExam: (id: number) => ipcRenderer.invoke('db-delete-exam', id),

  // Old Refraction Exam operations
  getOldRefractionExam: (examId: number) => ipcRenderer.invoke('db-get-old-refraction-exam', examId),
  getOldRefractionExamByLayoutInstance: (layoutInstanceId: number) => ipcRenderer.invoke('db-get-old-refraction-exam-by-layout-instance', layoutInstanceId),
  createOldRefractionExam: (examData: any) => ipcRenderer.invoke('db-create-old-refraction-exam', examData),
  updateOldRefractionExam: (examData: any) => ipcRenderer.invoke('db-update-old-refraction-exam', examData),

  // Objective Exam operations
  getObjectiveExam: (examId: number) => ipcRenderer.invoke('db-get-objective-exam', examId),
  getObjectiveExamByLayoutInstance: (layoutInstanceId: number) => ipcRenderer.invoke('db-get-objective-exam-by-layout-instance', layoutInstanceId),
  createObjectiveExam: (examData: any) => ipcRenderer.invoke('db-create-objective-exam', examData),
  updateObjectiveExam: (examData: any) => ipcRenderer.invoke('db-update-objective-exam', examData),

  // Subjective Exam operations
  getSubjectiveExam: (examId: number) => ipcRenderer.invoke('db-get-subjective-exam', examId),
  getSubjectiveExamByLayoutInstance: (layoutInstanceId: number) => ipcRenderer.invoke('db-get-subjective-exam-by-layout-instance', layoutInstanceId),
  createSubjectiveExam: (examData: any) => ipcRenderer.invoke('db-create-subjective-exam', examData),
  updateSubjectiveExam: (examData: any) => ipcRenderer.invoke('db-update-subjective-exam', examData),

  // Addition Exam operations
  getAdditionExam: (examId: number) => ipcRenderer.invoke('db-get-addition-exam', examId),
  getAdditionExamByLayoutInstance: (layoutInstanceId: number) => ipcRenderer.invoke('db-get-addition-exam-by-layout-instance', layoutInstanceId),
  createAdditionExam: (examData: any) => ipcRenderer.invoke('db-create-addition-exam', examData),
  updateAdditionExam: (examData: any) => ipcRenderer.invoke('db-update-addition-exam', examData),

  // Final Subjective Exam operations
  getFinalSubjectiveExam: (examId: number) => ipcRenderer.invoke('db-get-final-subjective-exam', examId),
  getFinalSubjectiveExamByLayoutInstance: (layoutInstanceId: number) => ipcRenderer.invoke('db-get-final-subjective-exam-by-layout-instance', layoutInstanceId),
  createFinalSubjectiveExam: (examData: any) => ipcRenderer.invoke('db-create-final-subjective-exam', examData),
  updateFinalSubjectiveExam: (examData: any) => ipcRenderer.invoke('db-update-final-subjective-exam', examData),
  deleteFinalSubjectiveExam: (id: number) => ipcRenderer.invoke('db-delete-final-subjective-exam', id),

  // Order operations
  getOrdersByClient: (clientId: number) => ipcRenderer.invoke('db-get-orders-by-client', clientId),
  getAllOrders: () => ipcRenderer.invoke('db-get-all-orders'),
  getOrder: (orderId: number) => ipcRenderer.invoke('db-get-order', orderId),
  createOrder: (orderData: any) => ipcRenderer.invoke('db-create-order', orderData),
  updateOrder: (orderData: any) => ipcRenderer.invoke('db-update-order', orderData),
  deleteOrder: (orderId: number) => ipcRenderer.invoke('db-delete-order', orderId),

  // Order Eye operations
  getOrderEyesByOrder: (orderId: number) => ipcRenderer.invoke('db-get-order-eyes-by-order', orderId),
  createOrderEye: (orderEyeData: any) => ipcRenderer.invoke('db-create-order-eye', orderEyeData),
  updateOrderEye: (orderEyeData: any) => ipcRenderer.invoke('db-update-order-eye', orderEyeData),

  // Order Lens operations
  getOrderLensByOrder: (orderId: number) => ipcRenderer.invoke('db-get-order-lens-by-order', orderId),
  createOrderLens: (orderLensData: any) => ipcRenderer.invoke('db-create-order-lens', orderLensData),
  updateOrderLens: (orderLensData: any) => ipcRenderer.invoke('db-update-order-lens', orderLensData),

  // Frame operations
  getFrameByOrder: (orderId: number) => ipcRenderer.invoke('db-get-frame-by-order', orderId),
  createFrame: (frameData: any) => ipcRenderer.invoke('db-create-frame', frameData),
  updateFrame: (frameData: any) => ipcRenderer.invoke('db-update-frame', frameData),

  // Order Details operations
  getOrderDetailsByOrder: (orderId: number) => ipcRenderer.invoke('db-get-order-details-by-order', orderId),
  createOrderDetails: (orderDetailsData: any) => ipcRenderer.invoke('db-create-order-details', orderDetailsData),
  updateOrderDetails: (orderDetailsData: any) => ipcRenderer.invoke('db-update-order-details', orderDetailsData),

  // Billing operations
  getBillingByOrder: (orderId: number) => ipcRenderer.invoke('db-get-billing-by-order', orderId),
  getBillingByContactLens: (contactLensId: number) => ipcRenderer.invoke('db-get-billing-by-contact-lens', contactLensId),
  createBilling: (billingData: any) => ipcRenderer.invoke('db-create-billing', billingData),
  updateBilling: (billingData: any) => ipcRenderer.invoke('db-update-billing', billingData),

  // Order Line Item operations
  getOrderLineItemsByBilling: (billingId: number) => ipcRenderer.invoke('db-get-order-line-items-by-billing', billingId),
  createOrderLineItem: (orderLineItemData: any) => ipcRenderer.invoke('db-create-order-line-item', orderLineItemData),
  updateOrderLineItem: (orderLineItemData: any) => ipcRenderer.invoke('db-update-order-line-item', orderLineItemData),
  deleteOrderLineItem: (orderLineItemId: number) => ipcRenderer.invoke('db-delete-order-line-item', orderLineItemId),

  // Medical Log operations
  getMedicalLogsByClient: (clientId: number) => ipcRenderer.invoke('db-get-medical-logs-by-client', clientId),
  createMedicalLog: (logData: any) => ipcRenderer.invoke('db-create-medical-log', logData),
  updateMedicalLog: (logData: any) => ipcRenderer.invoke('db-update-medical-log', logData),
  deleteMedicalLog: (id: number) => ipcRenderer.invoke('db-delete-medical-log', id),

  // Contact Lens operations
  getContactLensesByClient: (clientId: number) => ipcRenderer.invoke('db-get-contact-lenses-by-client', clientId),
  getAllContactLenses: () => ipcRenderer.invoke('db-get-all-contact-lenses'),
  getContactLens: (contactLensId: number) => ipcRenderer.invoke('db-get-contact-lens', contactLensId),
  createContactLens: (contactLensData: any) => ipcRenderer.invoke('db-create-contact-lens', contactLensData),
  updateContactLens: (contactLensData: any) => ipcRenderer.invoke('db-update-contact-lens', contactLensData),
  deleteContactLens: (contactLensId: number) => ipcRenderer.invoke('db-delete-contact-lens', contactLensId),

  // Contact Eye operations
  getContactEyesByContactLens: (contactLensId: number) => ipcRenderer.invoke('db-get-contact-eyes-by-contact-lens', contactLensId),
  createContactEye: (contactEyeData: any) => ipcRenderer.invoke('db-create-contact-eye', contactEyeData),
  updateContactEye: (contactEyeData: any) => ipcRenderer.invoke('db-update-contact-eye', contactEyeData),

  // Contact Lens Order operations
  getContactLensOrderByContactLens: (contactLensId: number) => ipcRenderer.invoke('db-get-contact-lens-order-by-contact-lens', contactLensId),
  createContactLensOrder: (contactLensOrderData: any) => ipcRenderer.invoke('db-create-contact-lens-order', contactLensOrderData),
  updateContactLensOrder: (contactLensOrderData: any) => ipcRenderer.invoke('db-update-contact-lens-order', contactLensOrderData),

  // Referral operations
  getReferralsByClient: (clientId: number) => ipcRenderer.invoke('db-get-referrals-by-client', clientId),
  getAllReferrals: () => ipcRenderer.invoke('db-get-all-referrals'),
  getReferral: (referralId: number) => ipcRenderer.invoke('db-get-referral', referralId),
  createReferral: (referralData: any) => ipcRenderer.invoke('db-create-referral', referralData),
  updateReferral: (referralData: any) => ipcRenderer.invoke('db-update-referral', referralData),
  deleteReferral: (referralId: number) => ipcRenderer.invoke('db-delete-referral', referralId),

  // ReferralEye operations
  getReferralEyesByReferral: (referralId: number) => ipcRenderer.invoke('db-get-referral-eyes-by-referral', referralId),
  createReferralEye: (referralEyeData: any) => ipcRenderer.invoke('db-create-referral-eye', referralEyeData),
  updateReferralEye: (referralEyeData: any) => ipcRenderer.invoke('db-update-referral-eye', referralEyeData),

  // Appointment operations
  getAppointmentsByClient: (clientId: number) => ipcRenderer.invoke('db-get-appointments-by-client', clientId),
  getAllAppointments: () => ipcRenderer.invoke('db-get-all-appointments'),
  getAppointment: (appointmentId: number) => ipcRenderer.invoke('db-get-appointment', appointmentId),
  createAppointment: (appointmentData: any) => ipcRenderer.invoke('db-create-appointment', appointmentData),
  updateAppointment: (appointmentData: any) => ipcRenderer.invoke('db-update-appointment', appointmentData),
  deleteAppointment: (appointmentId: number) => ipcRenderer.invoke('db-delete-appointment', appointmentId),

  // Settings operations
  getSettings: () => ipcRenderer.invoke('db-get-settings'),
  updateSettings: (settingsData: any) => ipcRenderer.invoke('db-update-settings', settingsData),

  // User operations
  getAllUsers: () => ipcRenderer.invoke('db-get-all-users'),
  getUser: (userId: number) => ipcRenderer.invoke('db-get-user', userId),
  getUserByUsername: (username: string) => ipcRenderer.invoke('db-get-user-by-username', username),
  createUser: (userData: any) => ipcRenderer.invoke('db-create-user', userData),
  updateUser: (userData: any) => ipcRenderer.invoke('db-update-user', userData),
  deleteUser: (userId: number) => ipcRenderer.invoke('db-delete-user', userId),
  authenticateUser: (username: string, password?: string) => ipcRenderer.invoke('db-authenticate-user', username, password),

  // File operations
  getFilesByClient: (clientId: number) => ipcRenderer.invoke('db-get-files-by-client', clientId),
  getAllFiles: () => ipcRenderer.invoke('db-get-all-files'),
  getFile: (fileId: number) => ipcRenderer.invoke('db-get-file', fileId),
  createFile: (fileData: any) => ipcRenderer.invoke('db-create-file', fileData),
  updateFile: (fileData: any) => ipcRenderer.invoke('db-update-file', fileData),
  deleteFile: (fileId: number) => ipcRenderer.invoke('db-delete-file', fileId),

  // Server Mode operations
  startServerMode: () => ipcRenderer.invoke('start-server-mode'),
  stopServerMode: () => ipcRenderer.invoke('stop-server-mode'),
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),

  // AI Agent operations
  aiInitialize: () => ipcRenderer.invoke('ai-initialize'),
  aiChat: (message: string, conversationHistory: any[]) => ipcRenderer.invoke('ai-chat', message, conversationHistory),
  aiChatStream: (message: string, conversationHistory: any[]) => ipcRenderer.invoke('ai-chat-stream', message, conversationHistory),
  aiExecuteAction: (action: string, data: any) => ipcRenderer.invoke('ai-execute-action', action, data),
  
  // AI Stream listeners
  onAiStreamChunk: (callback: (data: { chunk: string; fullMessage: string }) => void) => {
    ipcRenderer.on('ai-chat-stream-chunk', (_, data) => callback(data));
  },
  onAiStreamComplete: (callback: (data: { message: string }) => void) => {
    ipcRenderer.on('ai-chat-stream-complete', (_, data) => callback(data));
  },
  onAiStreamError: (callback: (data: { error: string }) => void) => {
    ipcRenderer.on('ai-chat-stream-error', (_, data) => callback(data));
  },
  removeAiStreamListeners: () => {
    ipcRenderer.removeAllListeners('ai-chat-stream-chunk');
    ipcRenderer.removeAllListeners('ai-chat-stream-complete');
    ipcRenderer.removeAllListeners('ai-chat-stream-error');
  },

  // Chat operations
  createChat: (title: string) => ipcRenderer.invoke('db-create-chat', title),
  getChatById: (chatId: number) => ipcRenderer.invoke('db-get-chat', chatId),
  getAllChats: () => ipcRenderer.invoke('db-get-all-chats'),
  updateChat: (chatData: any) => ipcRenderer.invoke('db-update-chat', chatData),
  deleteChat: (chatId: number) => ipcRenderer.invoke('db-delete-chat', chatId),

  // Chat Message operations
  createChatMessage: (chatMessageData: any) => ipcRenderer.invoke('db-create-chat-message', chatMessageData),
  getChatMessages: (chatId: number) => ipcRenderer.invoke('db-get-chat-messages', chatId),
  updateChatMessage: (chatMessageData: any) => ipcRenderer.invoke('db-update-chat-message', chatMessageData),
  deleteChatMessage: (chatMessageId: number) => ipcRenderer.invoke('db-delete-chat-message', chatMessageId),

  // Email operations
  emailTestConnection: () => ipcRenderer.invoke('email-test-connection'),
  emailSendTestReminder: (appointmentId: number) => ipcRenderer.invoke('email-send-test-reminder', appointmentId),
  emailSchedulerStatus: () => ipcRenderer.invoke('email-scheduler-status'),
  emailSchedulerRestart: () => ipcRenderer.invoke('email-scheduler-restart'),
  emailUpdateConfig: (config: any) => ipcRenderer.invoke('email-update-config', config),

  // Email Log operations
  getEmailLogsByAppointment: (appointmentId: number) => ipcRenderer.invoke('db-get-email-logs-by-appointment', appointmentId),
  getAllEmailLogs: () => ipcRenderer.invoke('db-get-all-email-logs'),

  // Lookup table operations
  getAllLookupSuppliers: () => ipcRenderer.invoke('db-get-all-lookup-suppliers'),
  createLookupSupplier: (data: any) => ipcRenderer.invoke('db-create-lookup-supplier', data),
  updateLookupSupplier: (data: any) => ipcRenderer.invoke('db-update-lookup-supplier', data),
  deleteLookupSupplier: (id: number) => ipcRenderer.invoke('db-delete-lookup-supplier', id),

  getAllLookupClinics: () => ipcRenderer.invoke('db-get-all-lookup-clinics'),
  createLookupClinic: (data: any) => ipcRenderer.invoke('db-create-lookup-clinic', data),
  updateLookupClinic: (data: any) => ipcRenderer.invoke('db-update-lookup-clinic', data),
  deleteLookupClinic: (id: number) => ipcRenderer.invoke('db-delete-lookup-clinic', id),

  getAllLookupOrderTypes: () => ipcRenderer.invoke('db-get-all-lookup-order-types'),
  createLookupOrderType: (data: any) => ipcRenderer.invoke('db-create-lookup-order-type', data),
  updateLookupOrderType: (data: any) => ipcRenderer.invoke('db-update-lookup-order-type', data),
  deleteLookupOrderType: (id: number) => ipcRenderer.invoke('db-delete-lookup-order-type', id),

  getAllLookupReferralTypes: () => ipcRenderer.invoke('db-get-all-lookup-referral-types'),
  createLookupReferralType: (data: any) => ipcRenderer.invoke('db-create-lookup-referral-type', data),
  updateLookupReferralType: (data: any) => ipcRenderer.invoke('db-update-lookup-referral-type', data),
  deleteLookupReferralType: (id: number) => ipcRenderer.invoke('db-delete-lookup-referral-type', id),

  getAllLookupLensModels: () => ipcRenderer.invoke('db-get-all-lookup-lens-models'),
  createLookupLensModel: (data: any) => ipcRenderer.invoke('db-create-lookup-lens-model', data),
  updateLookupLensModel: (data: any) => ipcRenderer.invoke('db-update-lookup-lens-model', data),
  deleteLookupLensModel: (id: number) => ipcRenderer.invoke('db-delete-lookup-lens-model', id),

  getAllLookupColors: () => ipcRenderer.invoke('db-get-all-lookup-colors'),
  createLookupColor: (data: any) => ipcRenderer.invoke('db-create-lookup-color', data),
  updateLookupColor: (data: any) => ipcRenderer.invoke('db-update-lookup-color', data),
  deleteLookupColor: (id: number) => ipcRenderer.invoke('db-delete-lookup-color', id),

  getAllLookupMaterials: () => ipcRenderer.invoke('db-get-all-lookup-materials'),
  createLookupMaterial: (data: any) => ipcRenderer.invoke('db-create-lookup-material', data),
  updateLookupMaterial: (data: any) => ipcRenderer.invoke('db-update-lookup-material', data),
  deleteLookupMaterial: (id: number) => ipcRenderer.invoke('db-delete-lookup-material', id),

  getAllLookupCoatings: () => ipcRenderer.invoke('db-get-all-lookup-coatings'),
  createLookupCoating: (data: any) => ipcRenderer.invoke('db-create-lookup-coating', data),
  updateLookupCoating: (data: any) => ipcRenderer.invoke('db-update-lookup-coating', data),
  deleteLookupCoating: (id: number) => ipcRenderer.invoke('db-delete-lookup-coating', id),

  getAllLookupManufacturers: () => ipcRenderer.invoke('db-get-all-lookup-manufacturers'),
  createLookupManufacturer: (data: any) => ipcRenderer.invoke('db-create-lookup-manufacturer', data),
  updateLookupManufacturer: (data: any) => ipcRenderer.invoke('db-update-lookup-manufacturer', data),
  deleteLookupManufacturer: (id: number) => ipcRenderer.invoke('db-delete-lookup-manufacturer', id),

  getAllLookupFrameModels: () => ipcRenderer.invoke('db-get-all-lookup-frame-models'),
  createLookupFrameModel: (data: any) => ipcRenderer.invoke('db-create-lookup-frame-model', data),
  updateLookupFrameModel: (data: any) => ipcRenderer.invoke('db-update-lookup-frame-model', data),
  deleteLookupFrameModel: (id: number) => ipcRenderer.invoke('db-delete-lookup-frame-model', id),

  getAllLookupContactLensTypes: () => ipcRenderer.invoke('db-get-all-lookup-contact-lens-types'),
  createLookupContactLensType: (data: any) => ipcRenderer.invoke('db-create-lookup-contact-lens-type', data),
  updateLookupContactLensType: (data: any) => ipcRenderer.invoke('db-update-lookup-contact-lens-type', data),
  deleteLookupContactLensType: (id: number) => ipcRenderer.invoke('db-delete-lookup-contact-lens-type', id),

  getAllLookupContactEyeLensTypes: () => ipcRenderer.invoke('db-get-all-lookup-contact-eye-lens-types'),
  createLookupContactEyeLensType: (data: any) => ipcRenderer.invoke('db-create-lookup-contact-eye-lens-type', data),
  updateLookupContactEyeLensType: (data: any) => ipcRenderer.invoke('db-update-lookup-contact-eye-lens-type', data),
  deleteLookupContactEyeLensType: (id: number) => ipcRenderer.invoke('db-delete-lookup-contact-eye-lens-type', id),

  getAllLookupContactEyeMaterials: () => ipcRenderer.invoke('db-get-all-lookup-contact-eye-materials'),
  createLookupContactEyeMaterial: (data: any) => ipcRenderer.invoke('db-create-lookup-contact-eye-material', data),
  updateLookupContactEyeMaterial: (data: any) => ipcRenderer.invoke('db-update-lookup-contact-eye-material', data),
  deleteLookupContactEyeMaterial: (id: number) => ipcRenderer.invoke('db-delete-lookup-contact-eye-material', id),

  getAllLookupCleaningSolutions: () => ipcRenderer.invoke('db-get-all-lookup-cleaning-solutions'),
  createLookupCleaningSolution: (data: any) => ipcRenderer.invoke('db-create-lookup-cleaning-solution', data),
  updateLookupCleaningSolution: (data: any) => ipcRenderer.invoke('db-update-lookup-cleaning-solution', data),
  deleteLookupCleaningSolution: (id: number) => ipcRenderer.invoke('db-delete-lookup-cleaning-solution', id),

  getAllLookupDisinfectionSolutions: () => ipcRenderer.invoke('db-get-all-lookup-disinfection-solutions'),
  createLookupDisinfectionSolution: (data: any) => ipcRenderer.invoke('db-create-lookup-disinfection-solution', data),
  updateLookupDisinfectionSolution: (data: any) => ipcRenderer.invoke('db-update-lookup-disinfection-solution', data),
  deleteLookupDisinfectionSolution: (id: number) => ipcRenderer.invoke('db-delete-lookup-disinfection-solution', id),

  getAllLookupRinsingSolutions: () => ipcRenderer.invoke('db-get-all-lookup-rinsing-solutions'),
  createLookupRinsingSolution: (data: any) => ipcRenderer.invoke('db-create-lookup-rinsing-solution', data),
  updateLookupRinsingSolution: (data: any) => ipcRenderer.invoke('db-update-lookup-rinsing-solution', data),
  deleteLookupRinsingSolution: (id: number) => ipcRenderer.invoke('db-delete-lookup-rinsing-solution', id),

  getAllLookupManufacturingLabs: () => ipcRenderer.invoke('db-get-all-lookup-manufacturing-labs'),
  createLookupManufacturingLab: (data: any) => ipcRenderer.invoke('db-create-lookup-manufacturing-lab', data),
  updateLookupManufacturingLab: (data: any) => ipcRenderer.invoke('db-update-lookup-manufacturing-lab', data),
  deleteLookupManufacturingLab: (id: number) => ipcRenderer.invoke('db-delete-lookup-manufacturing-lab', id),

  getAllLookupAdvisors: () => ipcRenderer.invoke('db-get-all-lookup-advisors'),
  createLookupAdvisor: (data: any) => ipcRenderer.invoke('db-create-lookup-advisor', data),
  updateLookupAdvisor: (data: any) => ipcRenderer.invoke('db-update-lookup-advisor', data),
  deleteLookupAdvisor: (id: number) => ipcRenderer.invoke('db-delete-lookup-advisor', id),

  // Exam Layout operations
  getAllExamLayouts: () => ipcRenderer.invoke('db-get-all-exam-layouts'),
  getExamLayoutById: (id: number) => ipcRenderer.invoke('db-get-exam-layout', id),
  createExamLayout: (layoutData: any) => ipcRenderer.invoke('db-create-exam-layout', layoutData),
  updateExamLayout: (layoutData: any) => ipcRenderer.invoke('db-update-exam-layout', layoutData),
  deleteExamLayout: (id: number) => ipcRenderer.invoke('db-delete-exam-layout', id),
  getDefaultExamLayout: () => ipcRenderer.invoke('db-get-default-exam-layout'),
  getLayoutsByExamId: (examId: number) => ipcRenderer.invoke('db-get-layouts-by-exam', examId),

  // Exam Layout Instance operations
  getExamLayoutInstanceById: (id: number) => ipcRenderer.invoke('db-get-exam-layout-instance', id),
  getExamLayoutInstancesByExamId: (examId: number) => ipcRenderer.invoke('db-get-exam-layout-instances-by-exam', examId),
  getActiveExamLayoutInstanceByExamId: (examId: number) => ipcRenderer.invoke('db-get-active-exam-layout-instance', examId),
  createExamLayoutInstance: (instanceData: any) => ipcRenderer.invoke('db-create-exam-layout-instance', instanceData),
  updateExamLayoutInstance: (instanceData: any) => ipcRenderer.invoke('db-update-exam-layout-instance', instanceData),
  deleteExamLayoutInstance: (id: number) => ipcRenderer.invoke('db-delete-exam-layout-instance', id),
  setActiveExamLayoutInstance: (examId: number, layoutInstanceId: number) => ipcRenderer.invoke('db-set-active-exam-layout-instance', examId, layoutInstanceId),
  ensureExamHasLayout: (examId: number) => ipcRenderer.invoke('db-ensure-exam-has-layout', examId),
});
