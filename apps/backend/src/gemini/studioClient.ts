import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiResponse, BrowserAction, WebsiteAnalysis } from '../types/index';

/**
 * GeminiStudioClient - Uses Google AI Studio API instead of Vertex AI
 * This has much better free-tier quotas (typically 15-60 RPM vs 2 RPM)
 */
export class GeminiStudioClient {
  private genAI: GoogleGenerativeAI;
  private modelName: string;
  private static lastRequestTime: number = 0;
  // 1 second between calls (60 RPM) — matches Vertex client
  private minRequestInterval: number = 1000;
  
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

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is required for Google AI Studio');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    console.log(`[GeminiStudioClient] Initialized with model: ${this.modelName}`);
  }

  private async throttleRequest(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - GeminiStudioClient.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      console.log(`[Gemini Studio] Throttling request, waiting ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    GeminiStudioClient.lastRequestTime = Date.now();
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.throttleRequest();
        return await fn();
      } catch (error: any) {
        const isRateLimit = error.message?.includes('429') || 
                           error.message?.includes('RESOURCE_EXHAUSTED') ||
                           error.message?.includes('quota');
        
        if (isRateLimit && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 5000;
          console.log(`[Gemini Studio] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
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
    return this.retryWithBackoff(async () => {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });

      const imageData = typeof screenshot === 'string' 
        ? screenshot 
        : screenshot.toString('base64');

      const prompt = this.buildPrompt(taskDescription, previousContext);

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageData,
          },
        },
        prompt,
      ]);

      const response = result.response;
      const responseText = response.text();

      if (!responseText) {
        throw new Error('No response from Gemini API');
      }

      return this.parseGeminiResponse(responseText);
    });
  }

  async planTask(
    screenshot: Buffer | string,
    taskDescription: string
  ): Promise<GeminiResponse> {
    return this.retryWithBackoff(async () => {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });

      const imageData = typeof screenshot === 'string' 
        ? screenshot 
        : screenshot.toString('base64');

      const planningPrompt = `You are Wayfinder AI. Analyze this screenshot and create a COMPLETE action plan to accomplish: "${taskDescription}"

IMPORTANT: Return a JSON object with a SEQUENCE of ALL actions needed to complete the task from start to finish.

Look for red numeric labels on interactive elements. Use [data-wayfinder-id="X"] selectors where X is the label number.

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

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageData,
          },
        },
        planningPrompt,
      ]);

      const response = result.response;
      const responseText = response.text();

      if (!responseText) {
        throw new Error('No response from Gemini API');
      }

      return this.parseGeminiResponse(responseText);
    });
  }

  async verifyTaskCompletion(
    screenshot: Buffer | string,
    taskDescription: string,
    executedActions: string[]
  ): Promise<{ completed: boolean; summary: string }> {
    return this.retryWithBackoff(async () => {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });

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

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageData,
          },
        },
        verificationPrompt,
      ]);

      const response = result.response;
      const responseText = response.text();

      if (!responseText) {
        return { completed: false, summary: 'No verification response received' };
      }

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
    });
  }

  async analyzeWebsite(screenshot: Buffer | string, url: string): Promise<WebsiteAnalysis> {
    return this.retryWithBackoff(async () => {
      const model = this.genAI.getGenerativeModel({ model: this.modelName });

      const imageData = typeof screenshot === 'string' 
        ? screenshot 
        : screenshot.toString('base64');

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageData,
          },
        },
        `Analyze this website screenshot from ${url}. Provide:
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
      ]);

      const responseText = result.response.text();

      if (!responseText) {
        throw new Error('No response from Gemini API');
      }

      return {
        url,
        screenshot: imageData,
        ...this.parseWebsiteAnalysis(responseText),
      };
    });
  }

  private buildPrompt(taskDescription: string, previousContext?: string): string {
    let prompt = `${this.systemPrompt}

You are analyzing a website screenshot to help accomplish this task: "${taskDescription}"

${previousContext ? `Previous context: ${previousContext}` : ''}

Analyze the current state of the page and determine the next action(s) needed to progress toward the goal.
Consider the visibility of elements, the current content, and the most efficient path forward.

Remember to respond ONLY with valid JSON matching the expected format.`;

    return prompt;
  }

  private parseGeminiResponse(responseText: string): GeminiResponse {
    try {
      let jsonStr = '';

      const codeBlockMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      } else {
        const objectMatch = responseText.match(/\{[\s\S]*\}/);
        const arrayMatch = responseText.match(/\[[\s\S]*\]/);
        
        if (objectMatch) {
          jsonStr = objectMatch[0];
        } else if (arrayMatch) {
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

      const parsed = JSON.parse(jsonStr);
      
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

      if (!parsed.decisions) {
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
    if (action.action === 'set_text' || action.type === 'set_text') {
      return {
        type: 'type',
        selector: action.selector || `.gLFyf`,
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
