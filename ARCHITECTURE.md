# Wayfinder AI - System Architecture

## High-Level Architecture

```mermaid
graph TB
    subgraph Client["🖥️ Frontend (Angular 17)"]
        Home["Home<br/>Component"]
        TaskForm["Task Form<br/>Component"]
        Screenshot["Screenshot<br/>Viewer"]
        ExecLog["Execution<br/>Log"]
        Idle["Agent Idle<br/>State"]
        Loading["Agent Loading<br/>State"]
        Auth["Auth Modal<br/>Component"]
        Theme["Theme<br/>Toggle"]
        UserMenu["User<br/>Menu"]
    end

    subgraph API["REST API Layer"]
        AgentAPI["Agent<br/>Endpoints"]
        AuthAPI["Auth<br/>Endpoints"]
        VoiceAPI["Voice<br/>Endpoints"]
        HistoryAPI["History<br/>Endpoints"]
    end

    subgraph Backend["⚙️ Backend (Node.js + Express)"]
        Controller["Agent<br/>Controller"]
        Manager["Agent<br/>Manager"]
        SessionMgr["Session<br/>Manager"]
        HistoryMgr["History<br/>Manager"]
    end

    subgraph Core["🧠 Intelligence & Automation"]
        Gemini["Gemini 2.0 Flash<br/>Multimodal"]
        Browser["Playwright<br/>Browser<br/>Controller"]
    end

    subgraph Storage["💾 Data Layer"]
        Firebase["Firebase<br/>Firestore"]
        Cache["Session<br/>Cache"]
    end

    subgraph External["🌐 External Services"]
        Website["Target<br/>Website"]
        GCloud["Google Cloud<br/>Vertex AI"]
    end

    Client -->|JSON REST| API
    API -->|Routes| Backend
    Backend -->|Orchestrates| Core
    Browser -->|Screenshots<br/>+ Context| Gemini
    Gemini -->|Analysis &<br/>Actions| Browser
    Browser -->|Automates| Website
    Backend -->|Stores/Updates| Storage
    Cache -->|Session<br/>State| Manager
    Firebase -->|Persist| Storage
    Gemini -->|Uses| GCloud

    style Client fill:#e1f5ff
    style API fill:#f3e5f5
    style Backend fill:#fff3e0
    style Core fill:#e8f5e9
    style Storage fill:#fce4ec
    style External fill:#f1f8e9
```

## Data Flow Diagram

```mermaid
sequenceDiagram
    participant User as 👤 User
    participant Frontend as 🎨 Frontend
    participant Backend as ⚙️ Backend
    participant Agent as 🧠 Agent
    participant Gemini as 🤖 Gemini
    participant Browser as 🔗 Browser
    participant Target as 🌐 Target Site

    User->>Frontend: 1. Enter task & URL
    Frontend->>Backend: 2. POST /api/agent/execute
    Backend->>Agent: 3. Initialize session
    Agent->>Browser: 4. Navigate to URL
    Browser->>Target: 5. Request page
    Target->>Browser: 6. Load page
    Browser->>Agent: 7. Take screenshot
    Agent->>Gemini: 8. Analyze screenshot
    Gemini->>Gemini: 9. Understand UI & plan action
    Gemini->>Agent: 10. Return action decision
    Agent->>Browser: 11. Execute action (click/type/scroll)
    Browser->>Target: 12. Interact with page
    Target->>Browser: 13. Page updates
    Browser->>Agent: 14. Take screenshot
    Agent->>Gemini: 15. Continue loop if task pending
    
    loop Until Task Complete
        Gemini->>Gemini: Analyze & decide
        Agent->>Browser: Execute action
        Browser->>Target: Interact
        Browser->>Agent: Take screenshot
    end

    Agent->>Browser: 16. Cleanup
    Browser->>Agent: 17. Return results
    Agent->>Backend: 18. Store completion
    Backend->>Frontend: 19. Update via SSE
    Frontend->>User: 20. Display results
```

## Component Architecture

```mermaid
graph TD
    App["App Module"]
    
    subgraph Presentation["Presentation Layer"]
        Home["Home Component"]
        Core["Core Components"]
        Auth["Auth Flow"]
    end

    subgraph Components["Smart Components"]
        TaskForm["TaskForm<br/>Input handling"]
        Screenshot["Screenshot<br/>Real-time display"]
        ExecLog["Execution Log<br/>Step tracking"]
        States["State Components<br/>Idle/Loading"]
    end

    subgraph Services["Service Layer"]
        Agent["Agent Service<br/>Task execution"]
        API["API Service<br/>HTTP calls"]
        Voice["Voice Service<br/>Audio I/O"]
        Auth["Auth Service<br/>Firebase auth"]
    end

    subgraph State["State Management"]
        AuthModal["Auth Modal Service<br/>BehaviorSubject"]
        Observable["RxJS Observables<br/>app-wide state"]
    end

    App -->|Declares| Presentation
    Presentation -->|Contains| Components
    Presentation -->|Injects| Services
    Components -->|Uses| Services
    Services -->|Manages| State
    Services -->|Calls| Observable
```

## Backend Architecture

```mermaid
graph TB
    Express["Express Server<br/>Port 3001"]
    
    subgraph Middleware["Middleware Layer"]
        CORS["CORS Handler"]
        Auth["Auth Middleware<br/>JWT verification"]
        Logger["Request Logger"]
    end

    subgraph Routes["API Routes"]
        AgentR["Agent Routes<br/>/api/agent/*"]
        AuthR["Auth Routes<br/>/api/auth/*"]
        VoiceR["Voice Routes<br/>/api/voice/*"]
        HistoryR["History Routes<br/>/api/agent/history/*"]
    end

    subgraph Controllers["Controllers"]
        AgentC["Agent Controller<br/>Task execution"]
        AuthC["Auth Controller<br/>User management"]
        VoiceC["Voice Controller<br/>Audio processing"]
    end

    subgraph Managers["Managers & Utils"]
        AgentMgr["Agent Manager<br/>Orchestration"]
        SessionMgr["Session Manager<br/>In-memory store"]
        HistoryMgr["History Manager<br/>DB persistence"]
        Queue["Task Queue<br/>Job scheduler"]
    end

    subgraph Intelligence["Intelligence Core"]
        GeminiClient["Gemini Client<br/>Multimodal analysis"]
        BrowserCtl["Browser Controller<br/>Playwright automation"]
    end

    subgraph Database["Data Persistence"]
        Firebase["Firebase Firestore<br/>Task history"]
        Cache["Memory Cache<br/>Session data"]
    end

    Express -->|Passes through| Middleware
    Middleware -->|Routes to| Routes
    Routes -->|Calls| Controllers
    Controllers -->|Uses| Managers
    Managers -->|Coordinates| Intelligence
    Intelligence -->|Reads/Writes| Database
    Intelligence -->|GCS Vertex AI| GCP["Google Cloud<br/>APIs"]
```

## Technology Stack

### Frontend
- **Framework**: Angular 17 (TypeScript)
- **Styling**: SCSS with CSS Custom Properties
- **Authentication**: Firebase Auth (Google Sign-in)
- **HTTP**: Angular HttpClient + Axios
- **State**: RxJS Observables + BehaviorSubjects
- **Build**: webpack (via Angular CLI)

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js (TypeScript)
- **Browser Automation**: Playwright
- **AI/ML**: Google Gemini 2.0 Flash (via Vertex AI)
- **Database**: Firebase Firestore
- **Cache**: In-memory SessionManager
- **API Communication**: Axios
- **Server-Sent Events**: Express native support

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Cloud Platform**: Google Cloud (Cloud Run, Vertex AI)
- **Frontend Hosting**: Firebase Hosting (optional)
- **Code Repository**: GitHub

## Key Integration Points

### Gemini Integration
```
Browser Screenshot (1280x720px)
    ↓
Gemini 2.0 Flash Multimodal
    ├─→ Visual Understanding (identify UI elements)
    ├─→ Context Analysis (page purpose)
    ├─→ Action Planning (next step decision)
    └─→ Response (structured JSON action)
        {
          "action": "click|type|scroll|navigate",
          "selector": "string",
          "value": "string",
          "reasoning": "string"
        }
```

### Playwright Integration
```
Gemini Action Decision
    ↓
Playwright Browser Controller
    ├─→ Navigate to URL
    ├─→ Wait for elements
    ├─→ Execute action (click, type, scroll)
    ├─→ Handle navigation/loading
    ├─→ Take screenshot
    └─→ Return to Agent Manager
```

### Firebase Integration
```
Frontend (Angular)
    ↓
Firebase Auth SDK
    ├─→ Google Sign-in
    ├─→ Token management
    └─→ User profile
        ↓
Backend Auth Middleware
    ├─→ Verify JWT token
    ├─→ Get user context
    └─→ Authorize requests
        ↓
Firestore
    ├─→ Store task history
    ├─→ Persist user preferences
    └─→ Track usage stats
```

## Message Formats

### Execute Task Request
```json
{
  "taskDescription": "Fill in contact form with John Doe",
  "startUrl": "https://example.com/contact",
  "context": {
    "userEmail": "user@example.com",
    "phoneNumber": "555-0123"
  }
}
```

### Task Status Response
```json
{
  "id": "session-abc123",
  "status": "running|completed|failed",
  "task": {
    "taskDescription": "...",
    "startUrl": "...",
    "progress": 45
  },
  "steps": [
    {
      "stepNumber": 1,
      "description": "Clicked on email input field",
      "action": {
        "type": "click",
        "selector": "input#email",
        "target": "email input"
      },
      "screenshot": "base64-encoded-image",
      "timestamp": "2026-02-25T10:30:00Z",
      "success": true
    }
  ],
  "currentScreenshot": "base64-encoded-image"
}
```

### SSE Stream Format
```
event: update
data: {"status":"running","steps":[...]}

event: update  
data: {"status":"completed","steps":[...]}
```

## Deployment Architecture

```
┌──────────────────────────────────────────────────┐
│           Google Cloud Platform                  │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │         Cloud Run (Backend)                │ │
│  │  - Containerized Node.js + Express         │ │
│  │  - Auto-scaling based on requests          │ │
│  │  - Environment: Google Cloud credentials   │ │
│  └────────────────────────────────────────────┘ │
│                     ↕                            │
│  ┌────────────────────────────────────────────┐ │
│  │      Vertex AI (Gemini API)                │ │
│  │  - Multimodal analysis via REST API        │ │
│  │  - Vision understanding                    │ │
│  │  - Action generation                       │ │
│  └────────────────────────────────────────────┘ │
│                     ↕                            │
│  ┌────────────────────────────────────────────┐ │
│  │     Firestore (Database)                   │ │
│  │  - Task history                            │ │
│  │  - User preferences                        │ │
│  │  - Usage statistics                        │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
           ↕
┌──────────────────────────────────────────────────┐
│      Firebase Hosting (Frontend)                 │
│  - Angular production build                      │
│  - Static assets                                 │
│  - CDN distribution                              │
└──────────────────────────────────────────────────┘
           ↕
┌──────────────────────────────────────────────────┐
│           User Browser                           │
│  - Angular 17 SPA                                │
│  - WebSocket/SSE for real-time updates           │
└──────────────────────────────────────────────────┘
```

## Error Handling & Resilience

```
Request
   ↓
Validation
   ├─→ Invalid input → 400 Bad Request
   └─→ Valid
        ↓
    Authentication
       ├─→ No token → 401 Unauthorized
       ├─→ Invalid token → 403 Forbidden
       └─→ Valid
            ↓
        Rate Limiting
           ├─→ Exceeded → 429 Too Many Requests
           └─→ OK
                ↓
            Business Logic
               ├─→ Resource not found → 404
               ├─→ Conflict → 409
               ├─→ Service unavailable → 503
               └─→ Success → 200/201
```

---

**Last Updated**: February 25, 2026  
**Contest**: Google Gemini Live Agent Challenge 2026  
**Category**: UI Navigator
