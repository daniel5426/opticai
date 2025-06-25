export interface EmailProvider {
  name: string;
  displayName: string;
  host: string;
  port: number;
  secure: boolean;
  authType: 'password' | 'app-password';
  instructions?: string;
}

export const EMAIL_PROVIDERS: Record<string, EmailProvider> = {
  gmail: {
    name: 'gmail',
    displayName: 'Gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    authType: 'app-password',
    instructions: 'Gmail דורש סיסמת אפליקציה מיוחדת. שלבים: 1) הפעל אימות דו-שלבי בחשבון Gmail 2) עבור להגדרות > אבטחה > סיסמאות אפליקציות 3) צור סיסמת אפליקציה חדשה עבור "Mail" 4) השתמש בסיסמת האפליקציה (לא הסיסמה הרגילה) בשדה הסיסמה כאן.'
  },
  outlook: {
    name: 'outlook',
    displayName: 'Outlook / Hotmail',
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    authType: 'password',
    instructions: 'השתמש בסיסמת המשתמש הרגילה שלך.'
  },
  yahoo: {
    name: 'yahoo',
    displayName: 'Yahoo Mail',
    host: 'smtp.mail.yahoo.com',
    port: 587,
    secure: false,
    authType: 'app-password',
    instructions: 'השתמש בסיסמת אפליקציה של Yahoo. עליך להפעיל אימות דו-שלבי תחילה.'
  },
  custom: {
    name: 'custom',
    displayName: 'הגדרה מותאמת אישית',
    host: '',
    port: 587,
    secure: false,
    authType: 'password',
    instructions: 'הזן את פרטי השרת של ספק האימייל שלך.'
  }
};

export function getEmailProviderConfig(providerName: string): EmailProvider | null {
  return EMAIL_PROVIDERS[providerName] || null;
}

export function getAllEmailProviders(): EmailProvider[] {
  return Object.values(EMAIL_PROVIDERS);
} 