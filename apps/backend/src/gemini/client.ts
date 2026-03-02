import { VertexAI } from '@google-cloud/vertexai';
import { GeminiResponse, BrowserAction, WebsiteAnalysis } from '../types/index';
import * as fs from 'fs';
import * as path from 'path';

export class GeminiClient {
  private vertexAI: VertexAI;
  private modelName: string;
  private maxRetries: number;
  // Make throttle state static to share across all instances
  private static lastRequestTime: number = 0;
  // With billing enabled, we have paid tier quotas (60+ RPM)
  // Use minimal throttling - just prevent bursts, let retry logic handle rate limits
  private minRequestInterval: number = 1000; // 1 second = 60 RPM max 
  private systemPrompt: string = `You are Wayfinder AI, an intelligent web automation agent with exceptional visual understanding capabilities.

Your role:
1. Analyze website screenshots to understand the UI layout and available actions
2. Interpret user intent from natural language commands  
3. Execute actions decisively and efficiently
4. Mark tasks complete when the goal is achieved

TASK COMPLETION RULES:
- "Search for X": Complete when search box has text AND you can see search results OR clicked search button
- "Click the first result": Complete when you clicked on a result link and it loaded (can be on new page)
- "Fill form and submit": Complete when form submitted successfully (page changed or confirmation visible)
- "Navigate to URL": Complete as soon as navigation action is taken
- If you see the goal result on screen → SET taskComplete=true immediately

ACTION TYPES:
- "click": Click element [data-wayfinder-id='X'] where X is the red label number
- "type": Type text into input field (selector and text required)
- "scroll": Scroll the page (helpful for finding labels)
- "navigate": Go to URL directly
- "wait": Delay (optional)
- "hover": Hover over element
- "press": Press keyboard key (Enter, Space, Escape, etc)

JSON RESPONSE FORMAT:
{
  "decisions": [{"action": {"type": "...", "selector": "...", ...}, "reasoning": "...", "confidence": 0.9}],
  "summary": "brief overall strategy",
  "taskComplete": true/false,
  "nextSteps": ["step N+1 if not complete"]
}

CRITICAL RULES:
✓ Use [data-wayfinder-id="X"] selectors (where X = red label number)
✓ Always mention label number in reasoning
✓ Be DECISIVE: Complete in 3-8 steps max
✓ Set taskComplete=true AS SOON as goal is visible/achieved
✓ Return exactly 1 action per response
✓ NO markdown code blocks - pure JSON only`;

  constructor(projectId: string, location: string = 'us-central1') {
    // Support both local development (with .gcp-key.json file) and Cloud Run (automatic credentials)
    let resolvedProjectId = projectId;
    let credentialsPath: string | null = null;

    // Try to find credentials file for local development
    // In Cloud Run, these paths won't exist, so we'll skip to automatic auth
    const possiblePaths: string[] = [];
    
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      possiblePaths.push(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    }
    
    const dirnamePath = path.resolve(__dirname, '../../.gcp-key.json');
    if (fs.existsSync(dirnamePath)) {
      possiblePaths.push(dirnamePath);
    }
    
    const cwdBackendPath = path.resolve(process.cwd(), 'apps/backend/.gcp-key.json');
    if (fs.existsSync(cwdBackendPath)) {
      possiblePaths.push(cwdBackendPath);
    }
    
    const cwdPath = path.resolve(process.cwd(), '.gcp-key.json');
    if (fs.existsSync(cwdPath)) {
      possiblePaths.push(cwdPath);
    }

    // If credentials file found, use it and extract project ID
    if (possiblePaths.length > 0) {
      credentialsPath = possiblePaths[0];
      console.log(`[GeminiClient] Loading credentials from file: ${credentialsPath}`);
      process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
      
      try {
        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
        resolvedProjectId = credentials.project_id || projectId;
      } catch (e) {
        console.warn(`[GeminiClient] Failed to parse credentials file, falling back to project ID: ${projectId}`);
      }
    } else {
      // Cloud Run: Use automatic credential discovery
      // The VertexAI client will automatically use the service account attached to the Cloud Run service
      console.log(`[GeminiClient] No credentials file found; using Cloud Run automatic authentication`);
    }

    // Initialize VertexAI client
    // In Cloud Run, this will automatically use the attached service account
    // In local dev, it will use the GOOGLE_APPLICATION_CREDENTIALS file
    this.vertexAI = new VertexAI({
      project: resolvedProjectId,
      location,
      apiEndpoint: `${location}-aiplatform.googleapis.com`,
    });

    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    this.maxRetries = Math.max(0, parseInt(process.env.GEMINI_MAX_RETRIES || '0', 10));
    console.log(`[GeminiClient] Initialized with project=${resolvedProjectId}, model=${this.modelName}, maxRetries=${this.maxRetries}`);
  }

  private async throttleRequest(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - GeminiClient.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      console.log(`[Gemini API] Throttling request, waiting ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Update static lastRequestTime
    GeminiClient.lastRequestTime = Date.now();
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = this.maxRetries
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Enforce throttling before EVERY attempt, including retries
        await this.throttleRequest();
        return await fn();
      } catch (error: any) {
        // Check for 429 OR 503 (Service Unavailable) which is also common for capacity issues
        const isRateLimit = error.message?.includes('RESOURCE_EXHAUSTED') || 
                           error.code === 429 || 
                           error.status === 429 ||
                           error.code === 503 ||
                           error.status === 503;
        
        if (isRateLimit && attempt < maxRetries) {
          // Exponential backoff with jitter to avoid thundering herd
          // Base: 10s, 20s, 40s, 80s, 160s (start higher to clear quota buffers)
          const baseDelay = Math.pow(2, attempt) * 10000; 
          const jitter = Math.random() * 2000;
          const delay = baseDelay + jitter;
          
          console.log(`[Gemini API] Rate limited (429/503), retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // If it is the last attempt, modify the error message to be more helpful
          if (isRateLimit && attempt === maxRetries) {
             throw new Error('Gemini API is currently overloaded (429/503). detailed: ' + error.message);
          }
          throw error;
        }
      }
    }
    throw new Error('Max retries exceeded');
  }

  async analyzeScreenshot(
    screenshot: Buffer | string,
    taskDescription: string,
    previousContext?: string
  ): Promise<GeminiResponse> {
    // throttleRequest is handled inside retryWithBackoff now
    
    return this.retryWithBackoff(async () => {
      try {
        const model = this.vertexAI.preview.getGenerativeModel({
          model: this.modelName,
        });

        const imageData = typeof screenshot === 'string' 
          ? screenshot 
          : screenshot.toString('base64');

        const request = {
          contents: [
            {
              role: 'user' as const,
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: imageData,
                  },
                },
                {
                  text: this.buildPrompt(taskDescription, previousContext),
                },
              ],
            },
          ],
        };

        const response = await model.generateContent(request as any);
        const responseText = response.response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
          throw new Error('No response from Gemini API');
        }

        return this.parseGeminiResponse(responseText);
      } catch (error: any) {
        console.error('[Gemini API] Full error details:', {
          message: error.message,
          code: error.code,
          status: error.status,
          statusText: error.statusText,
          details: error.details,
          stack: error.stack?.split('\n').slice(0, 3).join('\n')
        });
        
        // RE-THROW RATE LIMIT ERRORS RAW so retryWithBackoff can catch them
        if (error.code === 429 || error.status === 429 || error.message?.includes('RESOURCE_EXHAUSTED')) {
          console.log('[Gemini API] Detected rate limit in analyzeScreenshot, rethrowing for retry...');
          throw error;
        }

        if (error.message?.includes('PERMISSION_DENIED') || error.code === 403) {
          throw new Error('Permission denied. Check your Google Cloud credentials and API access.');
        }
        if (error.message?.includes('NOT_FOUND') || error.code === 404) {
          throw new Error('Model not found. Verify GEMINI_MODEL and region in .env file.');
        }
        if (error.message?.includes('INVALID_ARGUMENT')) {
          throw new Error('Invalid request. Check screenshot size or prompt format.');
        }
        
        // Return the actual error message for other cases
        throw new Error(`Gemini API error: ${error.message || 'Unknown error'}`);
      }
    });
  }

  async planTask(
    screenshot: Buffer | string,
    taskDescription: string
  ): Promise<GeminiResponse> {
    // Plan-then-execute: AI creates FULL action plan upfront
    return this.retryWithBackoff(async () => {
      try {
        const model = this.vertexAI.preview.getGenerativeModel({
          model: this.modelName,
        });

        const imageData = typeof screenshot === 'string' 
          ? screenshot 
          : screenshot.toString('base64');

        const planningPrompt = `You are Wayfinder AI. Analyze this screenshot and create a COMPLETE action plan to accomplish: "${taskDescription}"

IMPORTANT: Return a JSON object with a SEQUENCE of ALL actions needed to complete the task from start to finish.

Look for red numeric labels on interactive elements. Use [data-wayfinder-id="X"] selectors where X is the label number.

      FORM FILLING GUIDANCE:
      - Inputs may include helpful metadata: data-wayfinder-label, data-wayfinder-placeholder, data-wayfinder-name, data-wayfinder-type, data-wayfinder-required
      - Prefer fields whose label/placeholder/name clearly matches the requested data (email, phone, date, address, zip, name)
      - Fill required fields first, top to bottom, then submit
      - If you submit and see validation errors, target the field with the error and correct it

ACTION TYPES:
- "click": Click element (requires selector)
- "type": Type text (requires selector and text)
- "scroll": Scroll page (optional: amount in pixels)
- "navigate": Navigate to URL (requires url)
- "wait": Wait for delay (optional: delay in ms)
- "press": Press keyboard key (requires key)

Return JSON in this EXACT format:
{
  "decisions": [
    {"action": {"type": "click", "selector": "[data-wayfinder-id='5']"}, "reasoning": "Click search box (label 5)", "confidence": 0.9},
    {"action": {"type": "type", "selector": "[data-wayfinder-id='5']", "text": "search query"}, "reasoning": "Enter search term", "confidence": 0.9},
    {"action": {"type": "press", "key": "Enter"}, "reasoning": "Submit search", "confidence": 0.9}
  ],
  "summary": "Plan: Click search → Type query → Press Enter",
  "taskComplete": false,
  "nextSteps": []
}

Be decisive and efficient. Return ALL steps needed (typically 2-8 actions). Don't wrap in markdown.`;

        const request = {
          contents: [
            {
              role: 'user' as const,
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: imageData,
                  },
                },
                {
                  text: planningPrompt,
                },
              ],
            },
          ],
        };

        const response = await model.generateContent(request as any);
        const responseText = response.response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
          throw new Error('No response from Gemini API');
        }

        return this.parseGeminiResponse(responseText);
      } catch (error: any) {
        if (error.code === 429 || error.status === 429 || error.message?.includes('RESOURCE_EXHAUSTED')) {
          throw error;
        }
        throw new Error(`Task planning failed: ${error.message || 'Unknown error'}`);
      }
    });
  }

  async analyzeWebsite(screenshot: Buffer | string, url: string): Promise<WebsiteAnalysis> {
    // Wrapped in retryWithBackoff to handle transient errors/rate limits
    return this.retryWithBackoff(async () => {
      try {
        const model = this.vertexAI.preview.getGenerativeModel({
          model: this.modelName,
        });

        const imageData = typeof screenshot === 'string' 
          ? screenshot 
          : screenshot.toString('base64');

        const request = {
          contents: [
            {
              role: 'user' as const,
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: imageData,
                  },
                },
                {
                  text: `Analyze this website screenshot from ${url}. Provide:
1. A detailed description of the page content
2. List all interactive elements (buttons, links, forms, inputs, dropdowns)
3. The overall purpose and structure of the page
4. Any text visible on the page

Respond in JSON format:
{
  "analysis": "detailed analysis",
  "interactiveElements": ["element1", "element2", ...],
  "detectedText": "text found on page"
}`,
                },
              ],
            },
          ],
        };

        const response = await model.generateContent(request as any);
        const responseText = response.response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
          throw new Error('No response from Gemini API');
        }

        return {
          url,
          screenshot: typeof screenshot === 'string' ? screenshot : screenshot.toString('base64'),
          ...this.parseWebsiteAnalysis(responseText),
        };
      } catch (error: any) {
        // If it's a rate limit error, rethrow it RAW so retryWithBackoff can detect it
        if (error.code === 429 || error.status === 429 || error.message?.includes('RESOURCE_EXHAUSTED')) {
          throw error;
        }
        
        console.error('[Gemini API - analyzeWebsite] Error:', error.message);
        throw new Error(`Failed to analyze website: ${error.message || 'Unknown error'}`);
      }
    });
  }

  async verifyTaskCompletion(
    screenshot: Buffer | string,
    taskDescription: string,
    executedActions: string[]
  ): Promise<{ completed: boolean; summary: string }> {
    // Final verification: Check if task was successfully completed
    return this.retryWithBackoff(async () => {
      try {
        const model = this.vertexAI.preview.getGenerativeModel({
          model: this.modelName,
        });

        const imageData = typeof screenshot === 'string' 
          ? screenshot 
          : screenshot.toString('base64');

        const verificationPrompt = `You are verifying task completion.

Original task: "${taskDescription}"
Actions executed: ${executedActions.join(', ')}

Look at this screenshot and determine if the task was successfully completed.

Return JSON in this EXACT format:
{
  "completed": true/false,
  "summary": "Brief explanation of what was accomplished or what's missing"
}

Don't wrap in markdown.`;

        const request = {
          contents: [
            {
              role: 'user' as const,
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: imageData,
                  },
                },
                {
                  text: verificationPrompt,
                },
              ],
            },
          ],
        };

        const response = await model.generateContent(request as any);
        const responseText = response.response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
          return { completed: false, summary: 'No verification response received' };
        }

        // Parse verification response
        try {
          const cleaned = responseText.replace(/```(?:json)?\s*\n?/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);
          return {
            completed: parsed.completed || false,
            summary: parsed.summary || 'Task verification completed'
          };
        } catch {
          return { completed: false, summary: 'Could not parse verification response' };
        }
      } catch (error: any) {
        if (error.code === 429 || error.status === 429 || error.message?.includes('RESOURCE_EXHAUSTED')) {
          throw error;
        }
        return { completed: false, summary: `Verification failed: ${error.message}` };
      }
    });
  }

  async generateSuggestions(
    screenshot: Buffer | string,
    prompt: string
  ): Promise<any[]> {
    // Wrapped in retryWithBackoff to handle transient errors/rate limits
    return this.retryWithBackoff(async () => {
      try {
        const model = this.vertexAI.preview.getGenerativeModel({
          model: this.modelName,
        });

        const imageData = typeof screenshot === 'string' 
          ? screenshot 
          : screenshot.toString('base64');

        const request = {
          contents: [
            {
              role: 'user' as const,
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: imageData,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
          ],
        };

        const response = await model.generateContent(request as any);
        const responseText = response.response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
          throw new Error('No response from Gemini API');
        }

        return this.parseSuggestionsResponse(responseText);
      } catch (error: any) {
        // If it's a rate limit error, rethrow it RAW so retryWithBackoff can detect it
        if (error.code === 429 || error.status === 429 || error.message?.includes('RESOURCE_EXHAUSTED')) {
          throw error;
        }

        console.error('[Gemini API - generateSuggestions] Error:', error.message);
        throw new Error(`Failed to generate suggestions: ${error.message || 'Unknown error'}`);
      }
    });
  }

  private buildPrompt(taskDescription: string, previousContext?: string): string {
    let prompt = `You are analyzing a website screenshot to help accomplish this task: "${taskDescription}"

${previousContext ? `Previous context: ${previousContext}` : ''}

Analyze the current state of the page and determine the next action(s) needed to progress toward the goal.
Consider the visibility of elements, the current content, and the most efficient path forward.

When filling forms, use data-wayfinder-label/placeholder/name/type to match the correct field. Fill required fields first and fix validation errors if they appear after submit.

Remember to respond ONLY with valid JSON matching the expected format.`;

    return prompt;
  }

  private parseSuggestionsResponse(responseText: string): any[] {
    try {
      // Try to extract from markdown code blocks first
      const codeBlockMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      let jsonStr = '';

      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      } else {
        // Try to find JSON array
        const arrayMatch = responseText.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          jsonStr = arrayMatch[0];
        }
      }

      if (!jsonStr) {
        return [];
      }

      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Error parsing suggestions response:', responseText);
      return [];
    }
  }

  private parseGeminiResponse(responseText: string): GeminiResponse {
    try {
      let jsonStr = '';

      // Try to extract from markdown code blocks first
      const codeBlockMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      } else {
        // Try to find JSON object or array
        const objectMatch = responseText.match(/\{[\s\S]*\}/);
        const arrayMatch = responseText.match(/\[[\s\S]*\]/);
        
        if (objectMatch) {
          jsonStr = objectMatch[0];
        } else if (arrayMatch) {
          // If it's just an array of actions, wrap it
          jsonStr = JSON.stringify({
            decisions: arrayMatch[0],
            summary: 'Performing actions',
            taskComplete: false,
            nextSteps: [],
          });
        }
      }

      if (!jsonStr) {
        throw new Error('No JSON found in response');
      }

      // Parse and validate
      const parsed = JSON.parse(jsonStr);
      
      // If it's an array of actions, wrap it
      if (Array.isArray(parsed)) {
        return {
          decisions: parsed.map((action: any) => ({
            action: this.normalizeAction(action),
            reasoning: action.reasoning || `Performing ${action.type || action.action}`,
            confidence: action.confidence || 0.8,
          })),
          summary: 'Performing actions',
          taskComplete: false,
          nextSteps: [],
        };
      }

      // Ensure decisions array exists
      if (!parsed.decisions) {
        // If the model returned an action directly on the root object
        if (parsed.action) {
             parsed.decisions = [{
                 action: this.normalizeAction(parsed.action),
                 reasoning: parsed.reasoning || "Executing action",
                 confidence: parsed.confidence || 0.8
             }];
        } else {
             parsed.decisions = [];
        }
      }

      return parsed as GeminiResponse;
    } catch (error) {
      console.error('Error parsing Gemini response:', responseText);
      throw new Error('Failed to parse Gemini response as JSON');
    }
  }

  private normalizeAction(action: any): any {
    // Handle different action formats from Gemini
    if (action.action === 'set_text' || action.type === 'set_text') {
      return {
        type: 'type',
        selector: action.selector || `.gLFyf`, // Default Google search selector
        text: action.text,
      };
    }
    return action.action || action;
  }

  private parseWebsiteAnalysis(responseText: string): Omit<WebsiteAnalysis, 'url' | 'screenshot'> {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error parsing analysis response:', responseText);
      throw new Error('Failed to parse analysis response');
    }
  }
}
