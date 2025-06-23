# AI Assistant Setup Guide

This guide will help you set up the AI assistant feature for your optical clinic management system.

## Architecture Overview

The AI assistant uses a secure architecture:
- **Frontend**: React chat interface in the Electron app
- **Main Process**: LangchainJS agent with database tools
- **Proxy Server**: FastAPI backend that securely handles OpenAI API calls

## Setup Instructions

### 1. Install Dependencies

First, install the new npm dependencies:
```bash
npm install
```

### 2. Set up the Proxy Server

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file in the backend directory:
```bash
echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
```

Replace `your_openai_api_key_here` with your actual OpenAI API key.

### 3. Start the System

1. Start the proxy server (in a separate terminal):
```bash
cd backend
python main.py
```

The proxy server will start on `http://localhost:8001`

2. Start the Electron app:
```bash
npm run dev
```

### 4. Access the AI Assistant

1. Open the app and navigate to "עוזר חכם" (AI Assistant) in the sidebar
2. The AI will initialize automatically
3. Start chatting with questions like:
   - "מה התור הקרוב ביותר שלי?" (What's my next appointment?)
   - "תן לי סיכום של המטופלים החדשים השבוע" (Give me a summary of new patients this week)
   - "איזה בדיקות נעשו היום?" (What exams were done today?)

## Features

### What the AI Assistant Can Do

- **Query Data**: Search clients, appointments, exams, orders, and medical records
- **Analyze Trends**: Compare vision changes between exams
- **Suggest Actions**: Propose creating appointments or medical logs (with confirmation)
- **Answer Questions**: Provide insights about clinic operations

### Example Queries

- Client information: "תראה לי את המידע על דוד כהן" (Show me information about David Cohen)
- Appointments: "איזה תורים יש לי מחר?" (What appointments do I have tomorrow?)
- Medical analysis: "בהתבסס על הרשומה הרפואית של [שם], מה האבחנה שלך?" (Based on [name]'s medical record, what's your diagnosis?)
- Trends: "איך השתנתה הראייה של [שם] בין הבדיקות?" (How has [name]'s vision changed between exams?)

### Security Features

- OpenAI API key stays secure on the proxy server
- No direct client-to-OpenAI communication
- All database operations require confirmation for modifications
- Local data processing with external AI calls only when needed

## Troubleshooting

### Common Issues

1. **AI doesn't initialize**: Check that the proxy server is running on port 8001
2. **"Failed to connect to server"**: Ensure the backend server is started
3. **OpenAI errors**: Verify your API key is correct in the `.env` file
4. **Database errors**: Make sure the Electron app has initialized the database

### Logs

- Frontend logs: Check the browser developer tools in the Electron app
- Backend logs: Check the terminal where you started the proxy server
- Main process logs: Check the Electron console output

## Customization

### Adding New Tools

To add new capabilities to the AI agent, edit `src/lib/ai/ai-agent.ts`:

1. Add new tools to the `createTools()` method
2. Implement the tool logic using the database service
3. Update the system prompt if needed

### Modifying AI Behavior

Edit the system prompt in the `initializeAgent()` method to change how the AI responds or behaves.

## Requirements

- Node.js 16+
- Python 3.8+
- OpenAI API key
- Internet connection (for AI calls only)

The system works fully offline except for AI queries, which require internet to reach the OpenAI API through the secure proxy. 