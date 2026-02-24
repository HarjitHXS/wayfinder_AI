import { GeminiClient } from '../gemini/client';
import { Suggestion } from '../types/index';

export class SuggestionAgent {
  private geminiClient: GeminiClient;

  constructor(projectId: string, location?: string) {
    this.geminiClient = new GeminiClient(projectId, location);
  }

  async generateSuggestions(
    screenshot: Buffer | string,
    taskDescription: string,
    taskSummary: string
  ): Promise<Suggestion[]> {
    try {
      const prompt = `You are a helpful assistant providing UI suggestions to users after they complete a task.

Task completed: "${taskDescription}"
Task Summary: ${taskSummary}

Looking at the current state of the website in the screenshot, please provide 2-3 actionable suggestions for what the user should do next. These suggestions should:
1. Help the user proceed with their original goal or related tasks
2. Point to important interactive elements (buttons, links, forms) using natural descriptions
3. Be concise, friendly, and actionable
4. Focus on the USER INTENT, not technical selectors

Respond ONLY with a JSON array in this exact format:
[
  {
    "text": "User-friendly action instruction (e.g., 'Click the Search button to see results')",
    "description": "Brief explanation of why this is helpful (e.g., 'This will execute your search')",
    "target": "Only include if you have a very clear and readable selector, else omit this field",
    "actionType": "click|scroll|type|navigate"
  }
]

IMPORTANT:
- Omit 'target' field if the selector is technical jargon (like button[name='x'], input[type='y'])
- Focus on natural language descriptions users can understand
- Return ONLY the JSON array, no other text.`;

      const suggestions = await this.geminiClient.generateSuggestions(
        screenshot,
        prompt
      );

      return suggestions;
    } catch (error) {
      console.error('Error generating suggestions:', error);
      // Return empty array if suggestion generation fails
      return [];
    }
  }
}
