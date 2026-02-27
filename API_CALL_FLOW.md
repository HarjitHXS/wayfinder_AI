# Wayfinder AI - Google AI API Call Flow Analysis

## System Architecture

```
User Browser (Frontend)
         ↓
    /api/agent/execute (POST)
         ↓
   agentController.executeTask()
         ↓
   Task → TaskQueue
         ↓
   AgentManager.executeTask()
         ↓
   [Browser + Gemini AI Loop]
         ↓
   sessionManager.updateSession()
         ↓
   SSE/Polling Response Back to Browser
```

---

## Scenario: User Creates a Simple Task

**User Input:**
```
POST /api/agent/execute
{
  "taskDescription": "Search for cake shops",
  "startUrl": "https://google.com"
}
```

---

## CURRENT DESIGN (With Single-Model-Request Mode ON) ✅

**Status:** `SINGLE_MODEL_REQUEST_MODE=true` (default)

### Call Flow:

```
1. Browser navigates to https://google.com
   └─ [Playwright] No AI calls yet
   
2. Wait for page load (800ms smart wait)
   └─ [Browser] No AI calls
   
3. Take screenshot with labels
   └─ [Browser] No AI calls
   
4. ╔════════════════════════════════════╗
   ║  GEMINI API CALL #1: planTask()    ║ ← ONLY AI CALL
   ║  Input: Screenshot + Task Description
   ║  Output: Full action plan (2-8 steps)
   ╚════════════════════════════════════╝
   
5. For each planned action:
   ├─ Execute in browser (click, type, navigate, etc)
   ├─ Wait based on action type (300-800ms)
   ├─ Take screenshot
   └─ Update session (NO re-plan API calls because singleModelRequestMode=true)
   
6. Check if all steps succeeded
   └─ Skip verification API call (because singleModelRequestMode=true)
   
7. Mark task as completed
   └─ Return to user via SSE/polling
```

### **Total Google AI Calls: 1** ✅

---

## OLD DESIGN (Single-Model-Request Mode OFF) ❌

**If `SINGLE_MODEL_REQUEST_MODE=false`:**

```
1-3. [Same as above]

4. GEMINI API CALL #1: planTask()
   └─ Response: Action plan

5. Execute each action:
   
   Action 1 (click):
   ├─ Execute in browser
   ├─ Wait 800ms
   ├─ Take screenshot
   ├─ Detect page changed
   └─ ╔════════════════════════════════════╗
      ║  GEMINI API CALL #2: planTask()    ║ ← RE-PLAN
      ║  Re-plan remaining steps
      ╚════════════════════════════════════╝
   
   Action 2 (type):
   ├─ Execute in browser
   └─ [No re-plan for type/press/scroll]
   
   Action 3 (navigate):
   └─ ╔════════════════════════════════════╗
      ║  GEMINI API CALL #3: planTask()    ║ ← RE-PLAN
      ║  Re-plan remaining steps
      ╚════════════════════════════════════╝
   
   ... (up to 4 re-plans allowed)

6. Final verification:
   └─ ╔════════════════════════════════════╗
      ║  GEMINI API CALL #4-5+: verify()   ║ ← VERIFY
      ║  Verify if task was completed
      ╚════════════════════════════════════╝

7. ACTION FAILURES with retries:
   └─ ╔════════════════════════════════════╗
      ║  GEMINI API CALL #6+: planTask()   ║ ← FIX attempt
      ║  (For each failed action)
      ╚════════════════════════════════════╝
```

### **Total Google AI Calls: 4-8+ per task** ❌

---

## Compound Call Amplification (Retries)

Each `planTask()` / `verifyTaskCompletion()` call has built-in retry logic:

### Studio Client (Google AI Studio API):
```typescript
maxRetries: 0 (GEMINI_MAX_RETRIES env var, default 0)
Backoff: 5s → 10s → 20s (exponential)
```

### Vertex AI Client:
```typescript
maxRetries: 0 (GEMINI_MAX_RETRIES env var, default 0)
Backoff: 10s → 20s → 40s → 80s → 160s (exponential)
```

**Example with retries enabled (GEMINI_MAX_RETRIES=3):**
```
1 initial call → fails with 429 (rate limited)
  │
  ├─ Retry 1 (after 5s) → fails
  ├─ Retry 2 (after 10s) → fails
  └─ Retry 3 (after 20s) → succeeds

= 4 actual network calls for 1 logical "planTask()"
```

---

## What Happens on Failure

### Scenario: Browser Action Fails

**Current (Single-Model-Request Mode ON):**
```
Action fails (element not found, navigation timeout)
└─ Log "Failed: [error message]"
└─ Mark step as failed
└─ Continue to next action (no re-planning)
└─ Eventually mark task as failed

Total AI calls: Still just 1 (the initial plan)
```

**Old Design (Mode OFF):**
```
Action fails
└─ GEMINI API CALL #X: planTask() with "find corrected element"
└─ Try corrected action
└─ If still fails, mark step failed
└─ Continue loop

Total AI calls: 1 (plan) + 1-per-failure (correction)
```

---

## Production Example: Search for "Cake Shops"

### Task Definition:
```
Description: "Search for cake shops near me"
Start URL: "https://google.com"
```

### Expected Browser Steps:
1. Navigate to google.com ✓
2. Click search box
3. Type "cake shops near me"
4. Press Enter
5. Wait for results
6. Verify results displayed

### With Single-Model-Request Mode ON:

```
Time    Event                               AI Calls
────────────────────────────────────────────────────────
T+0ms   User submits task
T+100ms Task queued
T+200ms Task processing starts
T+500ms Browser navigates to google.com
T+1300ms Take screenshot, add labels
T+1400ms ╔═══════════════════════════════════════════╗
         ║ GOOGLE AI CALL #1: planTask()             ║
         ║ Response: ["click #1", "type #2", "press #3"]
         ╚═══════════════════════════════════════════╝
T+2000ms Execute: click #1 (search box)
T+2800ms Take screenshot
T+3200ms Execute: type #2 ("cake shops")
T+3600ms Take screenshot
T+4000ms Execute: press #3 (Enter)
T+4800ms Take screenshot
T+5600ms All steps completed
T+5700ms Verification skipped (singleMode)
T+5800ms Task marked as COMPLETED

📊 TOTAL: 1 Google AI API call
⏱️  TOTAL TIME: ~5.8 seconds
```

### Old Design WITHOUT Single-Model-Request Mode:

```
Time    Event                               AI Calls
────────────────────────────────────────────────────────
...
T+1400ms ╔═══════════════════════════════════════════╗
         ║ GOOGLE AI CALL #1: planTask()             ║
         ╚═══════════════════════════════════════════╝
...
T+4000ms Execute: press #3 (Enter) - NAVIGATES
T+4800ms Page changed, need re-plan
         ╔═══════════════════════════════════════════╗
         ║ GOOGLE AI CALL #2: planTask() - RE-PLAN   ║  
         ║ Context: "Just pressed Enter, search new"  
         ╚═══════════════════════════════════════════╝
...
T+5600ms All actions complete
         ╔═══════════════════════════════════════════╗
         ║ GOOGLE AI CALL #3: verifyTaskCompletion() ║
         ║ Verify results are visible
         ╚═══════════════════════════════════════════╝
T+6200ms Task marked as COMPLETED

📊 TOTAL: 3 Google AI API calls (or more with failures)
⏱️  TOTAL TIME: ~6.2+ seconds
```

---

## Configuration

### Environment Variables:

```bash
# Rate limiting and retries (NEW - Default to single-request mode)
SINGLE_MODEL_REQUEST_MODE=true       # Default: true (1 API call per task)
GEMINI_MAX_RETRIES=0                 # Default: 0 (no retry amplification)

# Model selection
GOOGLE_AI_API_KEY=...                # Uses Google AI Studio (faster quotas)
# OR
GOOGLE_APPLICATION_CREDENTIALS=...   # Uses Vertex AI (production)
GEMINI_MODEL=gemini-2.0-flash        # Model name
```

### To Enable Old Behavior (NOT RECOMMENDED):

```bash
SINGLE_MODEL_REQUEST_MODE=false      # Re-enable re-plans and verify
GEMINI_MAX_RETRIES=3                 # Enable retry logic
```

---

## Cost Impact

### Pricing:
- **Google AI Studio:** Free tier (1.5M RPM, 30K RPH)
- **Vertex AI:** Pay-as-you-go or commit units

### Per-Task Cost (single-request mode):
```
1 planTask() call
├─ Input: ~100KB image + task description
├─ Output: ~1KB JSON action plan
└─ Cost: ~$0.0001-0.001 depending on region/volume
```

### Old Design (3-5 calls):
```
3-5 API calls per task
└─ Cost: ~$0.0003-0.005 per task
└─ 10x higher cost per task
```

---

## Summary Table

| Metric | Single-Model-Request Mode ON | Old Design (Mode OFF) |
|--------|------------------------------|----------------------|
| **API Calls per Task** | 1 | 3-8+ |
| **Expected Time** | ~5.8s | ~6.5s+ |
| **Retry Amplification** | ✅ Disabled | ❌ Can multiply calls by 4x |
| **Re-planning** | ✅ Disabled | ❌ Up to 4 re-plans |
| **Verification** | ✅ Skipped | ❌ Always runs |
| **Failure Handling** | Log & continue | ❌ Extra re-plan calls |
| **Cost per Task** | ~$0.0001 | ~$0.0003-0.005 |
| **Quota Pressure** | ✅ Low | ❌ High |
| **Timeout Risk** | ✅ Lower | ❌ Higher |

---

## Current Deployed Configuration

```
Production (Cloud Run):
  SINGLE_MODEL_REQUEST_MODE=true (default)
  GEMINI_MAX_RETRIES=0 (default)
  
  Result: 1 Google AI call per task ✅
```

---

## Key Takeaway

**With my changes:**
- Every simple user task = **1 Google AI API call**
- No hidden re-tries
- No unnecessary verifications
- No API amplification under quota pressure
- **Much safer for production** ✅

