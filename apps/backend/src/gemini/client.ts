import { VertexAI } from '@google-cloud/vertexai';
import { GeminiResponse, BrowserAction, WebsiteAnalysis } from '../types/index';

export class GeminiClient {
  private vertexAI: VertexAI;
  private modelName: string;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 2500; // 2.5 seconds between requests to avoid rate limits
  private systemPrompt: string = `You are Wayfinder AI, an intelligent web automation agent with exceptional visual understanding capabilities.

Your role:
1. Analyze website screenshots to understand the UI layout and available actions
2. Interpret user intent from natural language commands  
3. Generate precise, executable browser actions to accomplish tasks
4. Provide clear reasoning for each decision
5. Handle complex multi-step workflows

When analyzing screenshots:
- Identify all interactive elements (buttons, inputs, links, forms, search boxes)
- Understand the page layout and content
- Determine the best sequence of actions to complete the task
- Consider accessibility and efficiency

ACTION TYPES AVAILABLE:
- "click": Click on an element (requires selector)
- "type": Type text into an input field (requires selector and text)
- "scroll": Scroll the page (optional: amount in pixels)
- "navigate": Navigate to a URL (requires url)
- "wait": Wait for a delay (optional: delay in ms)
- "hover": Hover over an element (requires selector)
- "press": Press a keyboard key (requires key like Enter, Space, etc)

CRITICAL: Always respond with a JSON object in this EXACT format:
{
  "decisions": [
    {
      "action": {"type": "click|type|scroll|navigate|wait|hover|press", "selector": "...", "text": "...", "url": "...", etc},
      "reasoning": "brief explanation of why this action",
      "confidence": 0.8
    }
  ],
  "summary": "overall strategy being employed",
  "taskComplete": false,
  "nextSteps": ["next action if task not complete"]
}

IMPORTANT: 
- For form inputs, use common selectors like input[type="search"], input[type="text"], etc
- Always reason about your actions
- Set taskComplete to true only when the user's goal is clearly achieved
- Return at least 1 decision per response
- Do NOT wrap your response in markdown code blocks`;

  constructor(projectId: string, location: string = 'us-central1') {
    this.vertexAI = new VertexAI({ project: projectId, location });
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  }

  private async throttleRequest(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      console.log(`[Gemini API] Throttling request, waiting ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    this.lastRequestTime = Date.now();
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 2
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const isRateLimit = error.message?.includes('RESOURCE_EXHAUSTED') || 
                           error.code === 429 || 
                           error.status === 429;
        
        if (isRateLimit && attempt < maxRetries) {
          const backoffDelay = Math.pow(2, attempt) * 3000; // 3s, 6s, 12s
          console.log(`[Gemini API] Rate limited, retrying in ${backoffDelay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
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
    await this.throttleRequest();
    
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
                    mimeType: 'image/png',
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
        
        // Check for specific error types
        if (error.code === 429 || error.status === 429) {
          throw new Error('Rate limit: Too many requests. Wait a moment and try again.');
        }
        if (error.message?.includes('RESOURCE_EXHAUSTED')) {
          // RESOURCE_EXHAUSTED can mean: rate limits, concurrency limits, token limits, or model capacity
          console.error('[Gemini API] RESOURCE_EXHAUSTED - This usually means rate limiting or model capacity, NOT quota limits');
          throw new Error('Gemini API temporarily unavailable (rate limit or capacity). Wait 30-60 seconds and retry.');
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

  async analyzeWebsite(screenshot: Buffer | string, url: string): Promise<WebsiteAnalysis> {
    await this.throttleRequest();
    
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
                  mimeType: 'image/png',
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
      console.error('[Gemini API - analyzeWebsite] Error:', error.message);
      throw new Error(`Failed to analyze website: ${error.message || 'Unknown error'}`);
    }
  }

  async generateSuggestions(
    screenshot: Buffer | string,
    prompt: string
  ): Promise<any[]> {
    await this.throttleRequest();
    
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
                  mimeType: 'image/png',
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
      console.error('[Gemini API - generateSuggestions] Error:', error.message);
      throw new Error(`Failed to generate suggestions: ${error.message || 'Unknown error'}`);
    }
  }

  private buildPrompt(taskDescription: string, previousContext?: string): string {
    let prompt = `You are analyzing a website screenshot to help accomplish this task: "${taskDescription}"

${previousContext ? `Previous context: ${previousContext}` : ''}

Analyze the current state of the page and determine the next action(s) needed to progress toward the goal.
Consider the visibility of elements, the current content, and the most efficient path forward.

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
