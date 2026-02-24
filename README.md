# 🚀 Wayfinder AI - Intelligent Web Automation Agent

Wayfinder AI is a next-generation AI agent that leverages Google's Gemini multimodal API to understand and interact with any website through visual understanding. Built for the Google AI Hackathon 2026.

## 🎯 Key Features

- **Visual UI Understanding** - Uses Gemini 2.0 Flash to analyze screenshots and understand complex layouts
- **Multimodal Intelligence** - Processes images and natural language to make intelligent decisions
- **Real-time Automation** - Executes browser actions (click, type, scroll, navigate) based on agent decisions
- **Beautiful Dashboard** - Live visualization of agent vision and execution steps
- **No DOM Access Required** - Works with any website using pure visual understanding
- **Complex Workflows** - Handles multi-step tasks with context awareness

## 💡 Example Workflows


- Form filling and submission
- Data extraction from multiple pages
- Cross-site navigation and integration
- Visual QA testing
- Web scraping with intelligence
- Automated testing of UI changes

## 🏗️ Project Structure

```
autosteer/
├── backend/                          # Node.js + TypeScript backend
│   ├── src/
│   │   ├── agents/manager.ts        # Core AI agent orchestration
│   │   ├── browser/controller.ts    # Playwright browser automation
│   │   ├── gemini/client.ts         # Gemini API integration
│   │   ├── controllers/             # API endpoints
│   │   ├── types/                   # TypeScript interfaces
│   │   └── index.ts                 # Express server entry
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── .env.example
├── frontend/                        # React + TypeScript dashboard
│   ├── src/
│   │   ├── components/
│   │   │   ├── TaskForm.tsx         # Input form for tasks
│   │   │   ├── ScreenshotViewer.tsx # Real-time screenshot display
│   │   │   └── ExecutionLog.tsx     # Step-by-step execution log
│   │   ├── App.tsx                  # Main application
│   │   └── index.tsx
│   ├── public/
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── docker-compose.yml               # Docker orchestration
└── README.md

```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (for local development)
- **Docker & Docker Compose** (for containerized setup)
- **Google Cloud Project** with Vertex AI enabled
- **Gemini API** credentials

### Step 1: Setup Environment Variables

```bash
# Backend setup
cd backend
cp .env.example .env
```

Edit `.env` with your Google Cloud credentials:
```env
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_REGION=us-central1
GEMINI_MODEL=gemini-2.0-flash
BACKEND_PORT=3001
FRONTEND_URL=http://localhost:3000
```

```bash
# Frontend setup
cd frontend
cp .env.example .env
```

### Step 2: Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### Step 3: Run Locally

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

Dashboard will be available at `http://localhost:3000`

### Step 4: Using Docker Compose

```bash
docker-compose up --build
```

Access:
- Dashboard: http://localhost:3000
- API: http://localhost:3001

## 📡 API Endpoints

### Execute Task
```bash
POST /api/agent/execute
Content-Type: application/json

{
  "taskDescription": "Fill out the contact form with name John and email john@example.com",
  "startUrl": "https://example.com/contact"
}

Response:
{
  "sessionId": "abc123",
  "task": {
    "id": "abc123",
    "taskDescription": "...",
    "status": "running",
    "steps": [],
    "currentScreenshot": "..."
  }
}
```

### Get Task Status
```bash
GET /api/agent/status/{sessionId}

Response:
{
  "id": "abc123",
  "status": "completed|running|failed",
  "steps": [
    {
      "stepNumber": 1,
      "description": "Click on contact form input",
      "action": {"type": "click", "selector": "input#name"},
      "result": "Clicked on input#name",
      "screenshot": "...",
      "timestamp": "2026-02-20T..."
    }
  ]
}
```

### Analyze Website
```bash
POST /api/agent/analyze
Content-Type: application/json

{
  "url": "https://example.com"
}

Response:
{
  "url": "https://example.com",
  "analysis": "This webpage contains a contact form...",
  "interactiveElements": ["button.submit", "input#email", ...],
  "detectedText": "Contact Us..."
}
```

## 🤖 How It Works

1. **Task Input** - User provides natural language task description and starting URL
2. **Initial Screenshot** - Agent captures the current state of the website
3. **Visual Analysis** - Gemini analyzes screenshot to understand layout & elements
4. **Decision Making** - AI decides next action based on task and current state
5. **Action Execution** - Browser automation executes the decision
6. **Feedback Loop** - Process repeats until task completion
7. **Result Visualization** - Dashboard shows all steps and screenshots

## 🔑 Key Technologies

- **Backend**: Node.js, TypeScript, Express
- **Frontend**: React 18, TypeScript
- **Browser Automation**: Playwright
- **AI/ML**: Google Gemini 2.0 Flash (Vertex AI)
- **Containerization**: Docker & Docker Compose
- **API Communication**: Axios

## 📊 System Architecture

```
┌─────────────────────────────────────────────────┐
│           Angular Dashboard (Frontend)            │
│  - Task Form Input                              │
│  - Real-time Screenshot Viewer                  │
│  - Execution Log & Step Tracking                │
└────────────────────┬────────────────────────────┘
                     │ REST API
                     │
┌────────────────────▼────────────────────────────┐
│        Express Server (Backend)                 │
│  - Request Handler                              │
│  - Session Management                           │
└────────┬──────────────────┬─────────────────────┘
         │                  │
    ┌────▼─────┐      ┌────▼──────┐
    │ Gemini   │      │ Playwright│
    │ Client   │      │ Browser   │
    │(Analyze) │      │(Automate) │
    └──────────┘      └───────────┘
         │                  │
    ┌────▼──────────────────▼─┐
    │   Agent Manager         │
    │  (Orchestration Loop)   │
    └────────────────────────┘
```

## 🎨 Dashboard Features

### Task Form
- URL input for target website
- Task description textarea
- Real-time feedback while executing

### Agent Vision
- Live screenshot display (16:9 aspect ratio)
- Automatically updates as agent interacts
- Viewport: 1280x720px

### Execution Log
- Step-by-step action tracking
- Action type badges (click, type, scroll, etc)
- Timing information
- Element selectors and values
- Success/failure indicators

## 🔒 Security Considerations

- Backend validates all URLs before navigation
- No sensitive data stored in screenshots
- API key injection via environment variables
- CORS configured for localhost development
- SQL injection & XSS protections in place

## 🧪 Testing Examples

Try these tasks to see Wayfinder AI in action:

1. **Simple Form Fill**
   ```
   URL: https://httpbin.org/forms/post
   Task: Fill out the form with sample data and submit
   ```

2. **Multi-step Navigation**
   ```
   URL: https://example.com
   Task: Navigate to the about page and find the company phone number
   ```

3. **Data Extraction**
   ```
   URL: https://json.org
   Task: Scroll through the page and capture all headings
   ```

## 🚀 Deployment

### Deploy to Google Cloud Run

```bash
# Build and push backend image
docker build -t gcr.io/PROJECT_ID/autosteer-backend ./backend
docker push gcr.io/PROJECT_ID/autosteer-backend

# Deploy to Cloud Run
gcloud run deploy autosteer-backend \
  --image gcr.io/PROJECT_ID/autosteer-backend \
  --platform managed \
  --memory 2Gi \
  --timeout 3600
```

### Deploy Frontend to Firebase or Vercel

```bash
# Build
npm run build

# Deploy (example with Firebase)
firebase deploy
```

## 📈 Performance Optimization

- **Lazy Loading** - Screenshots loaded on demand
- **Caching** - Browser cache for repeated sites
- **Batch Operations** - Multiple actions queued during waits
- **Timeout Handling** - Configurable step delays
- **Memory Management** - Browser instance cleanup

## 🐛 Troubleshooting

### "Browser not initialized"
- Ensure Playwright is installed: `yarn install`
- Check for compatible Chrome/Chromium version

### "Gemini API Error"
- Verify Google Cloud credentials are set
- Check PROJECT_ID is correct
- Ensure Vertex AI API is enabled in Cloud Console

### Screenshots not appearing
- Check browser viewport is properly sized
- Verify Playwright headless mode settings
- Ensure screenshots are being captured

### API not responds
- Backend might still be starting
- Check port 3001 is not in use
- Review backend logs for errors

## 🤝 Contributing

Contributions welcome! Areas for improvement:
- Additional browser actions support
- Enhanced error recovery
- Better element detection
- Performance optimizations
- Additional test cases

## � Additional Documentation

Comprehensive guides and templates are available in the [`docs/`](docs/) directory:

### 📖 Guides
- **[Deployment Guide](docs/guides/DEPLOYMENT_GUIDE.md)** - Deploy to Google Cloud Run & Firebase
- **[Submission Checklist](docs/guides/MANDATORY_SUBMISSION_CHECKLIST.md)** - Hackathon requirements
- **[Architecture Diagram](docs/guides/ARCHITECTURE_DIAGRAM_GUIDE.md)** - Create required diagrams
- **[Nx Migration](docs/guides/NX_MIGRATION_GUIDE.md)** - Convert to monorepo (optional)

### 🎨 Templates
- **Voice Features** - Add speech input/output for multimodal UX
- **Agent Personality** - Make the agent more conversational
- **Enhanced Prompts** - Improve Gemini interactions

See [docs/README.md](docs/README.md) for details.

## 📝 License

MIT License - See LICENSE file for details

## 🎓 Built For

Google AI Hackathon 2026 - UI Navigator Category

## 📞 Support

For issues or questions:
1. Check the [Troubleshooting](#-troubleshooting) section
2. Review additional documentation in [`docs/`](docs/)
3. Check Gemini API documentation
4. Check Playwright docs for browser automation

---

**Made with ❤️ and 🤖 Powered by Gemini**
