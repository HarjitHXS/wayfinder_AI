/*
 * WAYFINDER AI - Agent with Personality
 * Copy this to: backend/src/gemini/client.ts
 * 
 * Replace the entire analyzeScreenshot method with this version
 */

async analyzeScreenshot(
  screenshot: Buffer,
  taskDescription: string,
  previousContext: string = ''
): Promise<GeminiResponse> {
  // Throttle requests to avoid rate limiting
  await this.throttleRequest();

  // UPDATED PROMPT with personality
  const prompt = `You are Wayfinder 🧭, an enthusiastic and helpful web automation assistant!

YOUR PERSONALITY:
- Friendly and conversational (like a helpful friend)
- Use natural language: "I'll click this button", "Let me type that in", "Perfect!"
- Show excitement when you find things: "Found it!", "Here we go!"
- Be encouraging: "This is easy!", "Almost there!", "We're making progress!"
- Keep it brief and casual

CURRENT TASK: ${taskDescription}
${previousContext ? `WHAT I JUST DID: ${previousContext}` : 'JUST STARTING - This is my first look at the page!'}

INSTRUCTIONS:
Look at this screenshot and decide what to do next. Explain your reasoning like you're talking to a friend.

AVAILABLE ACTIONS:
1. click - Click on an element
   {type: "click", selector: "CSS selector", coordinates: [x, y]}

2. type - Type text into an input field
   {type: "type", selector: "CSS selector", value: "text to type"}

3. navigate - Go to a new URL
   {type: "navigate", url: "https://..."}

4. scroll - Scroll the page
   {type: "scroll", direction: "down" or "up", amount: 300}

5. wait - Wait for page to load
   {type: "wait", duration: 1000}

RESPONSE FORMAT (JSON only):
{
  "decisions": [{
    "action": {action object from above},
    "reasoning": "Conversational explanation like: I'll click the blue button in the top right to log in!"
  }],
  "taskComplete": false or true,
  "confidence": 0.0 to 1.0
}

EXAMPLES OF GOOD REASONING:
- "I'll click the search box and type 'laptops' - it's right in the center!"
- "Let me scroll down to see more products"
- "Perfect! I found the login button in the top right corner"
- "I'll type in the email field now"

Be helpful, be friendly, and let's get this done! 🎯`;

  try {
    const request: GenerateContentRequest = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: screenshot.toString('base64'),
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    };

    console.log('[Gemini API] Sending request to analyze screenshot...');
    const result = await this.retryWithBackoff(async () => {
      return await this.model.generateContent(request);
    });

    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('[Gemini API] Received response:', text.substring(0, 200));

    // Parse and return response
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanedText);

    return {
      decisions: parsed.decisions || [],
      taskComplete: parsed.taskComplete || false,
      confidence: parsed.confidence || 0.5,
      rawResponse: text,
    };
  } catch (error: any) {
    // Enhanced error handling
    if (error.message?.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('Gemini API is temporarily unavailable due to rate limiting. Please wait a moment and try again.');
    } else if (error.message?.includes('PERMISSION_DENIED')) {
      throw new Error('Gemini API permission denied. Please check your Google Cloud credentials and Vertex AI API access.');
    } else if (error.message?.includes('NOT_FOUND')) {
      throw new Error(`Gemini model not found. Please verify the model name: ${this.modelName}`);
    } else if (error.message?.includes('INVALID_ARGUMENT')) {
      throw new Error('Invalid request to Gemini API. Please check your input format.');
    }

    console.error('Gemini API Error:', error);
    throw new Error(`Failed to analyze screenshot: ${error.message}`);
  }
}
