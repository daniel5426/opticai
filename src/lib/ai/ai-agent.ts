import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import DatabaseService from '../db/index';

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
  private dbService: typeof DatabaseService;
  private tools: any[];

  constructor(config: AIAgentConfig, dbService: typeof DatabaseService) {
    this.dbService = dbService;
    
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
      (input) => {
        try {
          const clients = this.dbService.getAllClients();
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
      (input) => {
        try {
          const appointments = this.dbService.getAllAppointments();
          // Sort by date, most recent first
          appointments.sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());
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
      (input) => {
        try {
          let exams = this.dbService.getAllExams();
          exams = exams.sort((a, b) => new Date(b.exam_date || '').getTime() - new Date(a.exam_date || '').getTime());
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
      (input) => {
        try {
          const appointment = this.dbService.createAppointment(input);
          return `תור נוצר בהצלחה! פרטי התור: ${JSON.stringify(appointment, null, 2)}`;
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
      (input) => {
        try {
          const medicalLog = this.dbService.createMedicalLog(input);
          return `רשומה רפואית נוצרה בהצלחה! פרטי הרשומה: ${JSON.stringify(medicalLog, null, 2)}`;
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
          const appointment = this.dbService.createAppointment(data);
          return {
            success: true,
            message: 'תור נוצר בהצלחה!',
            data: appointment
          };

        case 'create_medical_log':
          const medicalLog = this.dbService.createMedicalLog(data);
          return {
            success: true,
            message: 'רשומה רפואית נוצרה בהצלחה!',
            data: medicalLog
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
} 