# AI Proxy Server Setup

## Prerequisites

1. Python 3.8 or higher
2. OpenAI API key

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create a `.env` file in the backend directory:
```
OPENAI_API_KEY=your_openai_api_key_here
```

3. Run the server:
```bash
python main.py
```

The server will start on `http://localhost:8001`

## Configuration

- Server host: `0.0.0.0` (accessible from all network interfaces)
- Server port: `8001`
- OpenAI model: `gpt-4o`

## Usage

The Electron app will automatically connect to this proxy server to make secure OpenAI API calls without exposing the API key to the client.

## Endpoints

- `POST /chat/completions` - OpenAI chat completions proxy
- `GET /health` - Health check endpoint 