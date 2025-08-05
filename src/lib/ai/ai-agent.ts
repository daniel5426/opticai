import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { apiClient } from '../api-client';

interface AIAgentConfig {
  proxyServerUrl: string;
}

interface AIResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export class AIAgent {
  private llm: ChatOpenAI;
  private agent: any = null;
  private tools: any[];

  constructor(config: AIAgentConfig) {
    
    this.llm = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0.7,
      configuration: {
        baseURL: config.proxyServerUrl,
        apiKey: 'proxy-key',
      },
    });

    this.tools = this.createTools();
    this.initializeAgent();
  }

  private createTools() {
    const getClients = tool(
      async (input) => {
        try {
          const response = await apiClient.getAllClients();
          const clients = response.data || [];
          if (!input.search || input.search.trim() === '' || input.search.toLowerCase() === 'all') {
            return JSON.stringify(clients.slice(0, 20), null, 2); // Limit results for readability
          } else {
            const searchTerm = input.search.toLowerCase();
            const filtered = clients.filter((client: any) => 
              client.first_name?.toLowerCase().includes(searchTerm) ||
              client.last_name?.toLowerCase().includes(searchTerm) ||
              client.phone_mobile?.includes(searchTerm) ||
              client.national_id?.includes(searchTerm)
            );
            return JSON.stringify(filtered, null, 2);
          }
        } catch (error) {
          return `Error retrieving clients: ${error}`;
        }
      },
      {
        name: 'get_clients',
        description: 'Get all clients or search clients by name, phone, or ID. Use this when user asks about patients/clients (מטופלים).',
        schema: z.object({
          search: z.string().describe('Search term for filtering clients, use "all" to get all clients'),
        }),
      }
    );

    const getAppointments = tool(
      async (input) => {
        try {
          const response = await apiClient.getAllAppointments();
          const appointments = response.data || [];
          // Sort by date, most recent first
          appointments.sort((a: any, b: any) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
          return JSON.stringify(appointments.slice(0, 10), null, 2);
        } catch (error) {
          return `Error retrieving appointments: ${error}`;
        }
      },
      {
        name: 'get_appointments',
        description: 'Get appointments for today or recent appointments. Use this when user asks about appointments (תורים).',
        schema: z.object({
          filter: z.string().describe('Filter for appointments, use "recent" for recent appointments'),
        }),
      }
    );

    const getExams = tool(
      async (input) => {
        try {
          const response = await apiClient.getAllExams();
          let exams = response.data || [];
          exams = exams.sort((a: any, b: any) => new Date(b.exam_date || '').getTime() - new Date(a.exam_date || '').getTime());
          return JSON.stringify(exams.slice(0, 10), null, 2);
        } catch (error) {
          return `Error retrieving exams: ${error}`;
        }
      },
      {
        name: 'get_exams',
        description: 'Get recent optical exams. Use this when user asks about eye exams (בדיקות עיניים).',
        schema: z.object({
          filter: z.string().describe('Filter for exams, use "recent" for recent exams'),
        }),
      }
    );

    const createAppointment = tool(
      async (input) => {
        try {
          const response = await apiClient.createAppointment(input);
          if (response.error) {
            return `שגיאה ביצירת התור: ${response.error}`;
          }
          return `תור נוצר בהצלחה! פרטי התור: ${JSON.stringify(response.data, null, 2)}`;
        } catch (error) {
          return `שגיאה ביצירת התור: ${error}`;
        }
      },
      {
        name: 'create_appointment',
        description: 'Create a new appointment. Use this when user wants to schedule an appointment (לקבוע תור).',
        schema: z.object({
          client_id: z.number().describe('Client ID for the appointment'),
          date: z.string().describe('Appointment date (YYYY-MM-DD format)'),
          time: z.string().describe('Appointment time (HH:MM format)'),
          first_name: z.string().optional().describe('Client first name'),
          last_name: z.string().optional().describe('Client last name'),
          phone_mobile: z.string().optional().describe('Client mobile phone'),
          exam_name: z.string().optional().describe('Type of examination'),
          note: z.string().optional().describe('Additional notes for the appointment'),
        }),
      }
    );

    const createMedicalLog = tool(
      async (input) => {
        try {
          const response = await apiClient.createMedicalLog(input);
          if (response.error) {
            return `שגיאה ביצירת הרשומה הרפואית: ${response.error}`;
          }
          return `רשומה רפואית נוצרה בהצלחה! פרטי הרשומה: ${JSON.stringify(response.data, null, 2)}`;
        } catch (error) {
          return `שגיאה ביצירת הרשומה הרפואית: ${error}`;
        }
      },
      {
        name: 'create_medical_log',
        description: 'Create a new medical log entry. Use this when user wants to add medical notes (להוסיף רשומה רפואית).',
        schema: z.object({
          client_id: z.number().describe('Client ID for the medical log'),
          log_date: z.string().optional().describe('Log date (YYYY-MM-DD format)'),
          log: z.string().describe('Medical log content/notes'),
        }),
      }
    );

    return [getClients, getAppointments, getExams, createAppointment, createMedicalLog];
  }

  private async initializeAgent() {
    this.agent = createReactAgent({ 
      llm: this.llm, 
      tools: this.tools
    });
  }

  async processMessage(message: string, conversationHistory: BaseMessage[] = []): Promise<AIResponse> {
    try {
      console.log('Processing message:', message);
      console.log('Conversation history length:', conversationHistory.length);

      if (!this.agent) {
        throw new Error('Agent not initialized');
      }

      // Build messages array with system message, conversation history, and current message
      const messages = [
        { 
          role: 'system', 
          content: `אתה עוזר חכם של מרפאת עיניים "אופטיק AI". אתה עוזר בעברית ומסייע בניהול המרפאה.

חשוב: אתה מדבר עם צוות המרפאה (רופאים/טכנאים), לא עם מטופלים! הם מורשים לגשת לכל המידע במערכת.

כללים חשובים:
- תמיד ענה בעברית
- היה קצר ובהיר
- כשמבקשים מידע על מטופלים, תורים או בדיקות - השתמש בכלים שלך מיד ללא בקשה לזיהוי
- המשתמש הוא צוות המרפאה ויש לו גישה לכל המידע
- תן תשובות מועילות ומקצועות
- כשמבקשים ליצור או להוסיף משהו, הצע לבצע את הפעולה

אתה יכול לעזור עם:

קריאת מידע:
- מידע על מטופלים - השתמש ב-get_clients
- מידע על תורים - השתמש ב-get_appointments  
- מידע על בדיקות עיניים - השתמש ב-get_exams

יצירת רשומות חדשות:
- יצירת תור חדש - השתמש ב-create_appointment
- הוספת רשומה רפואית - השתמש ב-create_medical_log

כשמבקשים "בדיקות שלי" או "התורים שלי" - הבן זאת כ"הבדיקות/התורים במרפאה" ולא כבקשה אישית.

אם המשתמש מבקש ליצור תור או להוסיף רשומה רפואית, אתה יכול לבצע את הפעולה. בקש את הפרטים הדרושים אם הם חסרים.

אם המשתמש שואל שאלה כללית, ענה בצורה ידידותית ותציע איך אתה יכול לעזור.` 
        },
        // Add conversation history
        ...conversationHistory,
        // Add current message
        { role: 'user', content: message }
      ];

      console.log('Total messages being sent to AI:', messages.length);

      // Use the LangGraph ReAct agent to process the message
      const inputs = { messages };

      // Stream the response
      const stream = await this.agent.stream(inputs, {
        streamMode: 'values',
      });

      let finalMessage = '';
      
      for await (const { messages } of stream) {
        const msg = messages[messages?.length - 1];
        if (msg?.content && typeof msg.content === 'string') {
          finalMessage = msg.content;
        }
      }

      return {
        success: true,
        message: finalMessage || 'מצטער, לא קיבלתי תגובה מהמערכת.',
      };
    } catch (error) {
      console.error('Error in processMessage:', error);
      return {
        success: false,
        message: 'מצטער, אירעה שגיאה בעיבוד הבקשה שלך.',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async *processMessageStream(message: string, conversationHistory: BaseMessage[] = []): AsyncGenerator<string, void, unknown> {
    try {
      console.log('Processing message with streaming:', message);

      // Use the non-streaming method first, then simulate streaming
      const response = await this.processMessage(message, conversationHistory);
      
      if (!response.success) {
        yield response.message;
        return;
      }

      // Simulate streaming by yielding the response character by character
      const fullMessage = response.message;
      let currentIndex = 0;
      const chunkSize = 2; // Characters per chunk
      const delay = 30; // Milliseconds between chunks

      while (currentIndex < fullMessage.length) {
        const chunk = fullMessage.slice(currentIndex, currentIndex + chunkSize);
        yield chunk;
        currentIndex += chunkSize;
        
        // Add a small delay to simulate streaming
        if (currentIndex < fullMessage.length) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } catch (error) {
      console.error('Error in processMessageStream:', error);
      yield 'מצטער, אירעה שגיאה בעיבוד הבקשה שלך.';
    }
  }

  async executeAction(action: string, data: any): Promise<AIResponse> {
    try {
      switch (action) {
        case 'create_appointment':
          const appointmentResponse = await apiClient.createAppointment(data);
          if (appointmentResponse.error) {
            return {
              success: false,
              message: 'שגיאה ביצירת התור',
              error: appointmentResponse.error
            };
          }
          return {
            success: true,
            message: 'תור נוצר בהצלחה!',
            data: appointmentResponse.data
          };

        case 'create_medical_log':
          const medicalLogResponse = await apiClient.createMedicalLog(data);
          if (medicalLogResponse.error) {
            return {
              success: false,
              message: 'שגיאה ביצירת הרשומה הרפואית',
              error: medicalLogResponse.error
            };
          }
          return {
            success: true,
            message: 'רשומה רפואית נוצרה בהצלחה!',
            data: medicalLogResponse.data
          };

        default:
          return {
            success: false,
            message: 'פעולה לא מזוהה',
            error: `Action "${action}" is not supported`
          };
      }
    } catch (error) {
      return {
        success: false,
        message: 'שגיאה בביצוע הפעולה',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async generateAllClientAiStates(clientId: number): Promise<{
    exam: string;
    order: string;
    referral: string;
    contact_lens: string;
    appointment: string;
    file: string;
    medical: string;
  }> {
    try {
      const allClientDataResponse = await apiClient.getAllClientDataForAi(clientId);
      const allClientData = allClientDataResponse.data;
      if (!allClientData) {
        return {
          exam: 'לא נמצא מידע על הלקוח',
          order: 'לא נמצא מידע על הלקוח',
          referral: 'לא נמצא מידע על הלקוח',
          contact_lens: 'לא נמצא מידע על הלקוח',
          appointment: 'לא נמצא מידע על הלקוח',
          file: 'לא נמצא מידע על הלקוח',
          medical: 'לא נמצא מידע על הלקוח'
        };
      }

      const prompt = `
# Medical Eye Care Expert AI Agent Prompt

You are a medical assistant specializing in ophthalmology. Analyze client information and prepare relevant data points for each system area.

## Key Principles:

### 1. **Cross-Domain Distribution**: 
Information must appear in ALL relevant domains, regardless of source:
- Medical allergies → MEDICAL + EXAM (relevant for procedures)
- Diabetes → MEDICAL + EXAM + REFERRAL (affects vision, needs monitoring)
- Eye surgery history → FILE + EXAM + MEDICAL

### 2. **Domain Functions**:
- **EXAM**: Eye examinations, prescriptions, medical conditions affecting vision
- **ORDER**: Glasses/lens orders, prescriptions, technical details
- **REFERRAL**: Specialist referrals, urgent symptoms, follow-up needs
- **CONTACT_LENS**: Lens fitting, allergies to solutions, complications
- **APPOINTMENT**: Past/future appointments, required monitoring
- **FILE**: Documents, images, test results, reports
- **MEDICAL**: Medical history, medications, allergies, conditions

### 3. **Smart Diagnostics**: 
Add diagnostic suggestions when patterns emerge:
🔍 חשד: Brief explanation based on symptom combinations

## Client Information:
${JSON.stringify(allClientData, null, 2)}

## Instructions:
- Provide 3-7 factual data points per relevant domain
- Include information in ALL domains where it's relevant
- Write ONLY factual information, NOT recommendations
- Always answer in Hebrew
- Skip domains with no relevant information

## Required Response Format:

[EXAM]
• First point
• Second point
• Third point

🔍 חשד: Diagnostic suggestion (if relevant)
[/EXAM]

[ORDER]
• First point
• Second point
• Third point
[/ORDER]

[REFERRAL]
• First point
• Second point
• Third point

🔍 חשד: Referral suggestion (if relevant)
[/REFERRAL]

[CONTACT_LENS]
• First point
• Second point
• Third point
[/CONTACT_LENS]

[APPOINTMENT]
• First point
• Second point
• Third point

🔍 חשד: Future examination recommendation (if relevant)
[/APPOINTMENT]

[FILE]
• First point
• Second point
• Third point
[/FILE]

[MEDICAL]
• First point
• Second point
• Third point

🔍 חשד: Pattern-based diagnostic suggestion (if relevant)
[/MEDICAL]

**Important**: Use exactly this format with the precise tags! If there's no relevant information for a domain, do not include its tags.

`
      const response = await this.llm.invoke([new HumanMessage(prompt)]);
      const content = response.content as string;

      // Parse the response to extract each section
      const sections = {
        exam: this.extractSection(content, 'EXAM'),
        order: this.extractSection(content, 'ORDER'),
        referral: this.extractSection(content, 'REFERRAL'),
        contact_lens: this.extractSection(content, 'CONTACT_LENS'),
        appointment: this.extractSection(content, 'APPOINTMENT'),
        file: this.extractSection(content, 'FILE'),
        medical: this.extractSection(content, 'MEDICAL')
      };

      return sections;
    } catch (error) {
      console.error('Error generating all AI states:', error);
      const errorMessage = 'שגיאה ביצירת מידע AI';
      return {
        exam: errorMessage,
        order: errorMessage,
        referral: errorMessage,
        contact_lens: errorMessage,
        appointment: errorMessage,
        file: errorMessage,
        medical: errorMessage
      };
    }
  }

  private extractSection(content: string, sectionName: string): string {
    const startTag = `[${sectionName}]`;
    const endTag = `[/${sectionName}]`;
    
    const startIndex = content.indexOf(startTag);
    const endIndex = content.indexOf(endTag);
    
    if (startIndex === -1 || endIndex === -1) {
      return 'לא נמצאו נתונים רלוונטיים לתחום זה';
    }
    
    const sectionContent = content.substring(startIndex + startTag.length, endIndex).trim();
    return sectionContent || 'לא נמצאו נתונים רלוונטיים לתחום זה';
  }

  async generateClientAiPartState(clientId: number, part: string, aiMainState?: string): Promise<string> {
    try {
      // If this method is called individually ),
      // get the client data directly
      const allClientDataResponse = await apiClient.getAllClientDataForAi(clientId);
      const allClientData = allClientDataResponse.data;
      if (!allClientData) {
        return 'לא נמצא מידע על הלקוח';
      }

      const partDescriptions = {
        exam: 'דף בדיקות עיניים - מציג את כל בדיקות הראייה, המרשמים, התוצאות והמלצות',
        order: 'דף הזמנות - מציג הזמנות משקפיים, עדשות, מסגרות וכל הפרטים הטכניים',
        referral: 'דף הפניות - מציג הפניות לרופאי עיניים, מומחים ובתי חולים',
        contact_lens: 'דף עדשות מגע - מציג התאמות עדשות מגע, בדיקות, הזמנות וטיפול',
        appointment: 'דף תורים - מציג תורים קודמים ועתידיים, סוגי בדיקות ומעקב',
        file: 'דף קבצים - מציג קבצים, תמונות, מסמכים ותוצאות בדיקות שצורפו',
        medical: 'דף רפואי - מציג היסטוריה רפואית, תרופות, אלרגיות ובעיות רפואיות'
      };

      const partDescription = partDescriptions[part as keyof typeof partDescriptions] || 'דף לא מוכר';

      const prompt = `
        אתה עוזר רפואי מומחה לעיניים. קיבלת מידע מקיף על לקוח במרפאה, וכעת אתה צריך לספק מידע רלוונטי ספציפי ל${partDescription}.
        
        חשוב: השב בעברית בלבד!
        
        המידע על הלקוח:
        ${JSON.stringify(allClientData, null, 2)}
        
        בהתבסס על המידע, אנא הכן רשימה קצרה של 3-5 נקודות מידע חשובות ורלוונטיות עבור ${partDescription}.
        
        הנקודות צריכות להיות:
        - קצרות וברורות (1-2 שורות לכל נקודה)
        - ספציפיות לתחום הזה
        - מועילות לצוות הרפואי
        - מסודרות לפי חשיבות
        
        פורמט התשובה:
        • נקודה ראשונה
        • נקודה שנייה
        • נקודה שלישית
        וכו'
        
        אם אין מידע רלוונטי לתחום הזה, אל תציג נקודות לא רלוונטיות. במקום זאת, ציין בדיוק: "לא נמצאו נתונים רלוונטיים לתחום זה".
      `;

      const response = await this.llm.invoke([new HumanMessage(prompt)]);
      return response.content as string;
    } catch (error) {
      console.error('Error generating AI part state:', error);
      return 'שגיאה ביצירת מידע AI לתחום זה';
    }
  }
}