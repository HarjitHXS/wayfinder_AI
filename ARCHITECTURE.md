# Wayfinder AI - System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                            │
│                                                                     │
│   🎤 Voice Input ────┐                        ┌──── 🔊 Voice Output│
│   ⌨️  Text Input ────┤                        │                     │
│                      │                        │                     │
└──────────────────────┼────────────────────────┼─────────────────────┘
                       │                        │
                       ▼                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    ANGULAR FRONTEND (Firebase Hosting)               │
│                                                                      │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────────┐  │
│  │  Task Form   │  │ Screenshot       │  │  Execution Log      │  │
│  │ Component    │  │ Viewer           │  │  Component          │  │
│  │              │  │                  │  │                     │  │
│  │ - URL input  │  │ - Live updates   │  │ - Step tracking    │  │
│  │ - Voice UI   │  │ - 16:9 display   │  │ - Voice narration  │  │
│  └──────────────┘  └──────────────────┘  └─────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Voice Service (Web Speech API)                  │  │
│  │  - Speech Recognition (STT)                                  │  │
│  │  - Speech Synthesis (TTS)                                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────┬────────────────────▲──────────────────────┘
                           │                    │
                HTTP/REST  │                    │  JSON + Base64
                           │                    │  Screenshots
                           ▼                    │
┌───────────────────────────────────────────────────────────────────────┐
│              NODE.JS BACKEND (Google Cloud Run)                       │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                     Express.js Server                           │ │
│  │  ┌──────────────────┐          ┌─────────────────────────┐     │ │
│  │  │ Agent Controller │          │  User Controller        │     │ │
│  │  │ - /execute       │          │  - Health checks        │     │ │
│  │  │ - /status        │          │                         │     │ │
│  │  └──────────────────┘          └─────────────────────────┘     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                           │                │                          │
│                           │                │                          │
│                           ▼                ▼                          │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    AGENT MANAGER                               │  │
│  │                                                                │  │
│  │  Orchestrates the AI decision loop:                           │  │
│  │  1. Take screenshot                                           │  │
│  │  2. Send to Gemini for analysis                              │  │
│  │  3. Get action decision                                       │  │
│  │  4. Execute browser action                                    │  │
│  │  5. Update task state                                         │  │
│  │  6. Repeat until complete                                     │  │
│  └───────────┬──────────────────────────┬─────────────────────────┘  │
│              │                          │                            │
│              │                          │                            │
│              ▼                          ▼                            │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐    │
│  │   GEMINI CLIENT     │    │  BROWSER CONTROLLER             │    │
│  │                     │    │                                 │    │
│  │ - Screenshot        │    │ - Playwright integration        │    │
│  │   analysis          │    │ - Browser pool management      │    │
│  │ - Decision making   │    │ - Action execution:            │    │
│  │ - Task completion   │    │   * Click                      │    │
│  │   detection         │    │   * Type                       │    │
│  │ - Personality       │    │   * Navigate                   │    │
│  │   prompts           │    │   * Scroll                     │    │
│  │ - Rate limiting     │    │   * Screenshot                 │    │
│  │ - Error handling    │    │ - Auto-recovery                │    │
│  └─────────┬───────────┘    └──────────┬──────────────────────┘    │
│            │                           │                            │
└────────────┼───────────────────────────┼────────────────────────────┘
             │                           │
             │                           │
             ▼                           ▼
┌─────────────────────────┐   ┌────────────────────────────────────┐
│   GOOGLE CLOUD          │   │     CHROMIUM BROWSER               │
│   VERTEX AI API         │   │                                    │
│                         │   │  ┌──────────────────────────────┐  │
│  ┌──────────────────┐   │   │  │  Headless Browser Instance   │  │
│  │  Gemini 2.0      │   │   │  │                              │  │
│  │  Flash Model     │   │   │  │  - Renders web pages        │  │
│  │                  │   │   │  │  - Executes JavaScript      │  │
│  │ Multimodal:      │   │   │  │  - Takes screenshots        │  │
│  │ - Vision         │   │   │  │  - Navigates websites       │  │
│  │ - Language       │   │   │  └──────────────────────────────┘  │
│  │ - Reasoning      │   │   │                                    │
│  └──────────────────┘   │   └────────────────────────────────────┘
│                         │
│  Features Used:         │
│  - Image understanding  │                  ┌──────────────────────┐
│  - JSON output          │                  │  EXTERNAL WEBSITES   │
│  - Function calling     │◄─────────────────┤                      │
│  - Rate limit handling  │    Automation    │  - google.com       │
│                         │    target        │  - amazon.com       │
└─────────────────────────┘                  │  - any website      │
                                             └──────────────────────┘

KEY FEATURES:
══════════════

🎤 MULTIMODAL INPUT                    🎯 VISUAL UNDERSTANDING
   - Voice commands                       - Screenshot analysis
   - Text input                           - No DOM required
   - Natural language                     - Works on any site

🤖 INTELLIGENT AGENT                   🔄 FEEDBACK LOOP
   - Gemini decision making               - Real-time adaptation  
   - Personality & voice                  - Error recovery
   - Context awareness                    - Task completion detection

☁️  GOOGLE CLOUD NATIVE                📊 LIVE MONITORING
   - Fully hosted on GCP                  - Real-time screenshots
   - Vertex AI integration                - Step-by-step logging
   - Scalable architecture                - Voice narration
```

## System Integration Diagram (Gemini Connections)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                        📡 SYSTEM INTEGRATION LAYER                         │
│                                                                             │
│  Shows how Gemini, Frontend, Backend, and Database communicate             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                                                   ┌──────────────────────┐
                                                   │   🌐 User Browser    │
                                                   │                      │
                                                   │ - WebSocket/SSE      │
                                                   │ - Real-time updates  │
                                                   │ - Screenshot stream  │
                                                   └──────────────┬───────┘
                                                                  │
                                                   ┌──────────────┼───────┐
                                                   │              │       │
                                       ┌───────────┘    HTTP/REST │       │
                                       │                           │       │
                    ┌──────────────────▼──────────────────┐        │       │
                    │  🎨 ANGULAR FRONTEND               │        │       │
                    │  (Firebase Hosting)                │        │       │
                    │                                    │        │       │
                    │  ┌──────────────────────────────┐ │        │       │
                    │  │ - Task Form Component        │ │        │       │
                    │  │ - Screenshot Viewer          │ │        │       │
                    │  │ - Execution Log              │ │        │       │
                    │  │ - Voice Input/Output Service │ │        │       │
                    │  └──────────────────────────────┘ │        │       │
                    │                                    │        │       │
                    │  ┌──────────────────────────────┐ │        │       │
                    │  │ Firebase Auth                │ │        │       │
                    │  │ - Google Sign-in             │ │        │       │
                    │  │ - Token Management           │ │        │       │
                    │  └──────────────┬───────────────┘ │        │       │
                    │                 │                 │        │       │
                    └────────┬────────┼─────────────────┘        │       │
                             │        │                          │       │
                   ┌─────────┼────────┼──────────────┐            │       │
                   │         │        │              │            │       │
                   │ 1. User │ 2. Auth Token │ 3. JWT │         │       │
                   │ Input   │ Exchange      │ Verify │         │       │
                   │         │               │        │            │       │
                   ▼         ▼               ▼        ▼            │       │
┌────────────────────────────────────────────────────────────────┐        │
│               ⚙️  NODE.JS BACKEND (Cloud Run)                 │        │
│                                                               │        │
│  ┌─────────────────────────────────────────────────────┐     │        │
│  │ Express.js Server + Middleware                      │     │        │
│  │ ├─ CORS, Auth, Logging                              │     │        │
│  │ ├─ Request validation                               │     │        │
│  │ └─ Error handling                                   │     │        │
│  └─────────────────────────────────────────────────────┘     │        │
│                         │                                      │        │
│         ┌───────────────┼───────────────┐                     │        │
│         │               │               │                     │        │
│         ▼               ▼               ▼                     │        │
│  ┌─────────────┐ ┌────────────┐ ┌────────────┐             │        │
│  │ Agent       │ │ Voice      │ │ Auth       │             │        │
│  │ Controller  │ │ Controller │ │ Controller │             │        │
│  │             │ │            │ │            │             │        │
│  │ - Execute   │ │ - STT      │ │ - Login    │             │        │
│  │ - Status    │ │ - TTS      │ │ - User     │             │        │
│  │ - History   │ │            │ │ - Logout   │             │        │
│  └──────┬──────┘ └────────────┘ └────────────┘             │        │
│         │                                                     │        │
│         ▼                                                     │        │
│  ┌─────────────────────────────────────────────────────┐     │        │
│  │ 🧠 AGENT MANAGER (Orchestration Core)              │     │        │
│  │                                                     │     │        │
│  │ ┌──────────────────────────────────────────────┐   │     │        │
│  │ │ Session Manager                              │   │     │        │
│  │ │ - Session state tracking                     │   │     │        │
│  │ │ - Browser pool management                    │   │     │        │
│  │ │ - Active task monitoring                     │   │     │        │
│  │ └──────────────────────────────────────────────┘   │     │        │
│  │                     │                               │     │        │
│  │                     ▼                               │     │        │
│  │ ┌──────────────────────────────────────────────┐   │     │        │
│  │ │ 🤖 GEMINI CLIENT                            │   │     │        │
│  │ │                                              │   │     │        │
│  │ │ Process:                                     │   │     │        │
│  │ │ 1. Receive screenshot from Browser           │   │     │        │
│  │ │ 2. Format multimodal request                 │   │     │        │
│  │ │ 3. Send to Vertex AI (Gemini 2.0 Flash)      │   │     │        │
│  │ │ 4. Receive structured decision (JSON)        │   │     │        │
│  │ │ 5. Parse action & parameters                 │   │     │        │
│  │ │ 6. Return to Agent Manager                   │   │     │        │
│  │ │                                              │   │     │        │
│  │ │ Features:                                    │   │     │        │
│  │ │ - Vision: UI understanding                   │   │     │        │
│  │ │ - Language: Task comprehension                │   │     │        │
│  │ │ - Reasoning: Action planning                  │   │     │        │
│  │ │ - State tracking: Remember context            │   │     │        │
│  │ └────────────────┬────────────────────────────┘   │     │        │
│  │                  │ 4. Screenshot +                │     │        │
│  │                  │    Task description            │     │        │
│  │                  │ 5. Action + Reasoning          │     │        │
│  │                  │                                │     │        │
│  │                  ▼                                │     │        │
│  │ ┌──────────────────────────────────────────────┐   │     │        │
│  │ │ 🔗 BROWSER CONTROLLER (Playwright)           │   │     │        │
│  │ │                                              │   │     │        │
│  │ │ Actions:                                     │   │     │        │
│  │ │ - Click (buttons, links)                     │   │     │        │
│  │ │ - Type (text input)                          │   │     │        │
│  │ │ - Navigate (URL changes)                     │   │     │        │
│  │ │ - Scroll (page navigation)                   │   │     │        │
│  │ │ - Screenshot (capture state)                 │   │     │        │
│  │ │                                              │   │     │        │
│  │ │ State Management:                            │   │     │        │
│  │ │ - Browser pool (10-20 instances)             │   │     │        │
│  │ │ - Page load waiting                          │   │     │        │
│  │ │ - Error recovery (retry on timeout)          │   │     │        │
│  │ └────────────────┬─────────────────────────────┘   │     │        │
│  │                  │                                 │     │        │
│  └──────────────────┼─────────────────────────────────┘     │        │
│                     │                                        │        │
└─────────────────────┼────────────────────────────────────────┘        │
                      │ 6. Interacts with                      │        │
                      ▼ External websites                      │        │
              ┌──────────────────┐                             │        │
              │ 🌐 EXTERNAL      │                             │        │
              │ WEBSITES         │                             │        │
              │                  │                             │        │
              │ - google.com     │                             │        │
              │ - amazon.com     │                             │        │
              │ - any website    │                             │        │
              │                  │                             │        │
              │ Returns:         │                             │        │
              │ - Page updates   │                             │        │
              │ - New content    │                             │        │
              │ - Screenshots    │                             │        │
              └────────────────────                             │        │
                       │                                        │        │
                       │ 7. Back to Agent Manager               │        │
                       └────────────────────────────────────────┘        │
                                   │                                     │
                      ┌────────────┼────────────┐                        │
                      │            │            │                        │
                      ▼            ▼            ▼                        │
         ┌─────────────────────────────────────────┐                   │
         │ 💾 FIREBASE FIRESTORE (Database)        │                   │
         │                                         │                   │
         │ Collections:                            │                   │
         │ ├─ /users/{userId}                      │                   │
         │ │  ├─ auth profile                      │                   │
         │ │  └─ preferences                       │                   │
         │ ├─ /sessions/{sessionId}                │                   │
         │ │  ├─ task description                  │                   │
         │ │  ├─ status (running/completed)        │                   │
         │ │  └─ metadata                          │                   │
         │ └─ /history/{userId}/tasks              │                   │
         │    ├─ completed task records            │                   │
         │    ├─ step-by-step logs                 │                   │
         │    └─ screenshots (base64)              │                   │
         │                                         │                   │
         │ 8. Store & Persist:                     │                   │
         │ - Task completion records               │                   │
         │ - User preferences                      │                   │
         │ - Usage statistics                      │                   │
         └─────────────────────────────────────────┘                   │
                      │                                                  │
                      │ 9. Fetch history & preferences                   │
                      └──────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          🤖 GOOGLE CLOUD VERTEX AI                          │
│                         (Gemini 2.0 Flash Model)                            │
│                                                                             │
│  REST API Endpoint: googleapis.com/aiplatform/v1beta1                      │
│                                                                             │
│  Input:                              Output:                               │
│  ┌──────────────────────────┐        ┌────────────────────────┐           │
│  │ - Image (Base64)         │        │ - Action type          │           │
│  │ - Task description       │   →    │ - Target selector      │           │
│  │ - Previous context       │        │ - Text values          │           │
│  │ - System prompt          │        │ - Reasoning            │           │
│  │ - Model: gemini-2.0-     │        │ - Confidence score     │           │
│  │   flash                  │        │ - Next action hint     │           │
│  └──────────────────────────┘        └────────────────────────┘           │
│                                                                             │
│  Capabilities:                                                              │
│  ✓ Vision Understanding: Identify UI elements, buttons, text fields       │
│  ✓ Language Understanding: Parse task description, interpret intent       │
│  ✓ Reasoning: Plan next action, understand state                          │
│  ✓ JSON Output: Structured action decisions                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

COMPLETE DATA FLOW:
═══════════════════

User Input (Text/Voice)
         │
         ▼
Frontend (Angular) ←────────────────┐ Firebase Auth
         │                          │
         │ HTTP POST /api/agent     │ Google Sign-in
         │ {taskDescription, url}   │ Token Exchange
         │                          │
         ▼                          │
Backend (Express)                   │
    │                              │
    ├─→ Validate JWT Token ────────┘
    │
    ├─→ Agent Manager
    │   │
    │   ├─→ Browser Controller
    │   │   - Navigate to URL
    │   │   - Take screenshot
    │   │
    │   └─→ Gemini Client
    │       │
    │       ├─→ Send Screenshot to Vertex AI (Gemini 2.0 Flash) 🤖
    │       │
    │       ├─→ Receive structured action decision
    │       │
    │       └─→ Parse decision → Return to Browser Controller
    │
    ├─→ Execute Browser Action
    │
    ├─→ Store in Firestore ────→ 💾 Database
    │
    └─→ Stream updates via SSE ────→ Frontend
         (Real-time progress)
         (Screenshots)
         (Execution logs)

SECURITY & AUTHENTICATION:
══════════════════════════
✓ Frontend: Firebase Auth (Google Sign-in)
✓ Backend: JWT token validation on every request
✓ Gemini: Service Account credentials (server-side only)
✓ Database: Firestore rules (user-scoped access)
✓ HTTPS: All communications encrypted
```

## Data Flow Diagram

```
👤 USER
   │
   │ 1. Enter task & URL
   ▼
┌─────────────────────────────────────────────┐
│          🎨 ANGULAR FRONTEND                │
│  Task Form → Voice Input → Send Task        │
└────────────┬────────────────────────────────┘
             │ 2. HTTP POST /api/agent/execute
             ▼
┌─────────────────────────────────────────────┐
│          ⚙️  NODE.JS BACKEND                │
│  Agent Controller → Initialize Session      │
└────────────┬────────────────────────────────┘
             │ 3. Start Agent Manager loop
             ▼
┌─────────────────────────────────────────────────┐
│          🧠 AGENT MANAGER LOOP                  │
│                                                 │
│  4. Navigate to URL                             │
│  5. Browser loads page                          │
│  6. Take screenshot of loaded page              │
│         │                                       │
│         ▼                                       │
│  ┌────────────────────────────────────────┐    │
│  │ 8. Send screenshot + task to Gemini    │    │
│  └─────────────────┬──────────────────────┘    │
│                    │ 9. Analyze UI & plan       │
│                    ▼                            │
│  ┌────────────────────────────────────────┐    │
│  │  🤖 GEMINI 2.0 FLASH (Multimodal)      │    │
│  │  - Vision: Understand UI layout        │    │
│  │  - Language: Interpret task            │    │
│  │  - Reasoning: Plan next action         │    │
│  └─────────────────┬──────────────────────┘    │
│                    │ 10. Return action         │
│                    ▼                            │
│  ┌────────────────────────────────────────┐    │
│ 11. │ BROWSER CONTROLLER (Playwright)     │    │
│  │ - Execute: click/type/scroll/navigate  │    │
│  └─────────────────┬──────────────────────┘    │
│                    │ 12. Interact with page    │
│                    ▼                            │
│  ┌────────────────────────────────────────┐    │
│  │  🌐 TARGET WEBSITE                     │    │
│  │  13. Page updates                      │    │
│  └─────────────────┬──────────────────────┘    │
│                    │ 14. Take screenshot       │
│                    ▼                            │
│  ✓ Loop: Check if task complete                │
│    ├─→ No → Return to step 8 (analyze)         │
│    └─→ Yes → Go to step 16 (cleanup)           │
└────────────┬────────────────────────────────────┘
             │ 16. Cleanup & Store results
             ▼
┌─────────────────────────────────────────┐
│      💾 FIRESTORE DATABASE              │
│  18. Store task history & completion    │
└────────────┬────────────────────────────┘
             │ 19. SSE stream update
             ▼
┌─────────────────────────────────────────┐
│      🎨 ANGULAR FRONTEND                │
│  20. Display results + Screenshot       │
└────────────┬────────────────────────────┘
             │
             ▼
        👤 USER
    (Sees results)
```

## Component Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    📦 APP MODULE (Angular)                     │
└────────────────────────┬─────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌──────────────────┐ ┌──────────────┐ ┌════════════════┐
│  Home Component  │ │ Core         │ │ Auth Flow      │
│                  │ │ Components   │ │                │
│ - Dashboard      │ │              │ │ - Auth Modal   │
│ - Main Layout    │ │ - Shared UI  │ │ - Sign In      │
│ - Routing        │ └──────────────┘ │ - User Menu    │
└────────┬─────────┘                   └────────┬───────┘
         │         [ PRESENTATION LAYER ]       │
         └─────────────┬──────────────────────────┘
                       │ Inject & Use
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              📦 SMART COMPONENTS                             │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   TaskForm      │  │  Screenshot     │                  │
│  │   Component     │  │  Viewer         │                  │
│  │                 │  │                 │                  │
│  │ - URL input     │  │ - Live display  │                  │
│  │ - Task text     │  │ - Auto-refresh  │                  │
│  │ - Speak button  │  │ - Base64 decode │                  │
│  │ - Send button   │  │                 │                  │
│  └────────┬────────┘  └────────┬────────┘                  │
│           │                    │                            │
│  ┌────────┴────────┐  ┌────────┴────────┐                 │
│  │                 ▼  ▼                 │                 │
│  │  ┌──────────────────────────────┐   │                 │
│  │  │  Execution Log Component     │   │                 │
│  │  │ - Step tracking              │   │                 │
│  │  │ - Voice narration            │   │                 │
│  │  │ - Timeline view              │   │                 │
│  │  └──────────────────────────────┘   │                 │
│  │                                      │                 │
│  │  ┌──────────────────────────────┐   │                 │
│  │  │  State Components            │   │                 │
│  │  │ - Agent Idle State           │   │                 │
│  │  │ - Agent Loading State        │   │                 │
│  │  │ - Error States               │   │                 │
│  │  └──────────────────────────────┘   │                 │
│  └───────────┬──────────────────────────┘                 │
└──────────────┼────────────────────────────────────────────┘
               │ Use & Subscribe
               ▼
┌──────────────────────────────────────────────────────────────┐
│              🔧 SERVICE LAYER                               │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ Agent Service    │  │  API Service     │               │
│  │                  │  │                  │               │
│  │ - Execute task   │  │ - HTTP client    │               │
│  │ - Get status     │  │ - Error handling │               │
│  │ - Stream updates │  │ - Timeout mgmt   │               │
│  └────────┬─────────┘  └────────┬─────────┘               │
│           │                     │                          │
│  ┌────────┴─────────┐  ┌────────┴───────────┐            │
│  │                  ▼  ▼                    │            │
│  │  ┌────────────────────────────────────┐ │            │
│  │  │  Voice Service                     │ │            │
│  │  │ - Speech Recognition (STT)         │ │            │
│  │  │ - Speech Synthesis (TTS)           │ │            │
│  │  └────────────────────────────────────┘ │            │
│  │                                          │            │
│  │  ┌────────────────────────────────────┐ │            │
│  │  │  Auth Service                      │ │            │
│  │  │ - Firebase Auth SDK                │ │            │
│  │  │ - Token management                 │ │            │
│  │  │ - User session                     │ │            │
│  │  └────────────────────────────────────┘ │            │
│  └───────────────┬──────────────────────────┘            │
└──────────────────┼────────────────────────────────────────┘
                   │ Manage & Notify
                   ▼
┌──────────────────────────────────────────────────────────────┐
│              📊 STATE MANAGEMENT                            │
│                                                              │
│  ┌────────────────────────────────────┐                    │
│  │ Auth Modal Service                 │                    │
│  │ (BehaviorSubject)                  │                    │
│  │ - Visibility state                 │                    │
│  │ - Modal data                       │                    │
│  └────────────────┬───────────────────┘                    │
│                   │                                         │
│  ┌────────────────┴────────────────┐                      │
│  │                                 ▼                      │
│  │  ┌──────────────────────────────────────┐              │
│  │  │  RxJS Observables (App-wide State)   │              │
│  │  │  - Task execution state              │              │
│  │  │  - User authentication state         │              │
│  │  │  - UI visibility state               │              │
│  │  │  - Screenshot stream                 │              │
│  │  └──────────────────────────────────────┘              │
│  └──────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────────┘
```

## Backend Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  🚀 EXPRESS.JS SERVER                           │
│                       (Port 3001)                               │
└────────────────────────┬──────────────────────────────────────────┘
                         │ HTTP Requests
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                  🛡️  MIDDLEWARE LAYER                            │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │  CORS Handler    │  │ Auth         │  │ Request        │   │
│  │                  │  │ Middleware   │  │ Logger         │   │
│  │ - Origin check   │  │              │  │                │   │
│  │ - Headers        │  │ - JWT verify │  │ - Logging      │   │
│  │ - Methods        │  │ - User ctx   │  │ - Monitoring   │   │
│  └────────┬─────────┘  └──────┬───────┘  └────────┬───────┘   │
│           │                   │                   │             │
└───────────┼───────────────────┼───────────────────┼─────────────┘
            │                   │                   │
            └───────────────────┼───────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                  📍 API ROUTES LAYER                             │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ Agent Routes     │  │  Auth Routes     │                    │
│  │ /api/agent/*     │  │  /api/auth/*     │                    │
│  └────────┬─────────┘  └────────┬─────────┘                    │
│           │                     │                               │
│  ┌────────┴─────────┐  ┌────────┴──────────┐                  │
│  │                  ▼  ▼                   │                  │
│  │  ┌────────────────────────────────┐    │                  │
│  │  │  Voice Routes                  │    │                  │
│  │  │  /api/voice/*                  │    │                  │
│  │  └────────────────────────────────┘    │                  │
│  │                                         │                  │
│  │  ┌────────────────────────────────┐    │                  │
│  │  │  History Routes                │    │                  │
│  │  │  /api/agent/history/*          │    │                  │
│  │  └────────────────────────────────┘    │                  │
│  └──────────────────┬───────────────────────┘                 │
└─────────────────────┼──────────────────────────────────────────┘
                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                  🎛️  CONTROLLERS LAYER                           │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ Agent Controller │  │  Auth Controller │                    │
│  │                  │  │                  │                    │
│  │ - /execute task  │  │ - /login         │                    │
│  │ - /get status    │  │ - /logout        │                    │
│  │ - /stream        │  │ - /user info     │                    │
│  └────────┬─────────┘  └────────┬─────────┘                    │
│           │                     │                               │
│  ┌────────┴────────────────────────┬──┐                        │
│  │                                 ▼  │                        │
│  │  ┌──────────────────────────────┐ │                        │
│  │  │  Voice Controller            │ │                        │
│  │  │                              │ │                        │
│  │  │ - /transcribe (STT)          │ │                        │
│  │  │ - /synthesize (TTS)          │ │                        │
│  │  └──────────────────────────────┘ │                        │
│  └───────────────────────────────────┘                         │
└──────────────────┬───────────────────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                  ⚙️  MANAGERS & UTILITIES                         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                 Agent Manager                            │   │
│  │  ┌──────────────────────────────────────────────────┐    │   │
│  │  │ Orchestrates the AI decision loop:               │    │   │
│  │  │  1. Take screenshot via Browser Controller       │    │   │
│  │  │  2. Send to Gemini for analysis                 │    │   │
│  │  │  3. Get action decision                         │    │   │
│  │  │  4. Execute browser action                      │    │   │
│  │  │  5. Update session state                        │    │   │
│  │  │  6. Store step in history                       │    │   │
│  │  └──────────────────────────────────────────────────┘    │   │
│  └────────────┬───────────────────────────────────────────────┘   │
│               │                                                    │
│  ┌────────────┴────────────────┬─────────────────────────┐        │
│  │                             ▼                         │        │
│  │  ┌──────────────────────────────────────────────┐     │        │
│  │  │  Session Manager                            │     │        │
│  │  │ - In-memory store                           │     │        │
│  │  │ - Track active tasks                        │     │        │
│  │  │ - Manage browser pools                      │     │        │
│  │  │ - Clean up expired sessions                 │     │        │
│  │  └──────────────────────────────────────────────┘     │        │
│  │                                                        │        │
│  │  ┌──────────────────────────────────────────────┐     │        │
│  │  │  History Manager                            │     │        │
│  │  │ - Persist to Firestore                      │     │        │
│  │  │ - Fetch user task history                   │     │        │
│  │  │ - Delete old records                        │     │        │
│  │  └──────────────────────────────────────────────┘     │        │
│  │                                                        │        │
│  │  ┌──────────────────────────────────────────────┐     │        │
│  │  │  Task Queue                                 │     │        │
│  │  │ - Job scheduler                             │     │        │
│  │  │ - Rate limiting                             │     │        │
│  │  │ - Retry logic                               │     │        │
│  │  └──────────────────────────────────────────────┘     │        │
│  └────────────┬────────────────────────────────────┘        │
└─────────────────┼────────────────────────────────────────────┘
                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                  🧠 INTELLIGENCE CORE                            │
│                                                                  │
│  ┌──────────────────────────┐  ┌────────────────────────────┐  │
│  │  Gemini Client           │  │  Browser Controller        │  │
│  │                          │  │                            │  │
│  │ - Multimodal analysis    │  │ - Playwright integration   │  │
│  │ - Vision understanding   │  │ - Browser pool management  │  │
│  │ - Decision making        │  │ - Screenshot capture       │  │
│  │ - JSON output parsing    │  │ - Action execution        │  │
│  │ - Error handling         │  │ - Navigation handling      │  │
│  │ - Rate limiting          │  │ - Auto-recovery logic      │  │
│  └────────┬─────────────────┘  └────────┬───────────────────┘  │
│           │                            │                        │
└───────────┼────────────────────────────┼────────────────────────┘
            │                            │
     Uses  │                            │ Uses
            ▼                            ▼
┌─────────────────────────────┐  ┌──────────────────────────────┐
│  Google Cloud Vertex AI     │  │  Chromium Browser            │
│                             │  │  (Headless)                  │
│  - Gemini 2.0 Flash API     │  │                              │
│  - REST endpoint            │  │  - Page rendering            │
│  - Multimodal processing    │  │  - JavaScript execution      │
│  - Vision + Language        │  │  - Screenshot creation       │
│                             │  │  - Form interaction          │
└─────────────────────────────┘  └──────────────────────────────┘
            │                            │
            │ Calls                      │ Automates
            └────┬───────────────────────┘
                 ▼
         ┌───────────────────┐
         │  External         │
         │  Websites         │
         │                   │
         │ - google.com      │
         │ - amazon.com      │
         │ - any website     │
         └───────────────────┘

           Back to Storage ↓

┌──────────────────────────────────────────────────────────────────┐
│                  💾 DATA PERSISTENCE LAYER                       │
│                                                                  │
│  ┌──────────────────────────┐  ┌─────────────────────────────┐ │
│  │  Memory Cache            │  │  Firebase Firestore         │ │
│  │  (Session Manager)       │  │  (Real Database)            │ │
│  │                          │  │                             │ │
│  │ - Active sessions        │  │ - Task history              │ │
│  │ - Browser pools          │  │ - User preferences          │ │
│  │ - Real-time state        │  │ - Usage statistics          │ │
│  │ - Short-lived (in-RAM)   │  │ - Long-term persistence    │ │
│  └──────────────────────────┘  └─────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
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
- **Containerization**: Docker
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
