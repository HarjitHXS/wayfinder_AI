import { BrowserController } from '../browser/controller';
import { GeminiClient } from '../gemini/client';
import { SuggestionAgent } from './suggestionAgent';
import { TaskExecution, ExecutionStep, AgentDecision } from '../types/index';

export class AgentManager {
  private browserController: BrowserController;
  private geminiClient: GeminiClient;
  private suggestionAgent: SuggestionAgent;
  private task?: TaskExecution;
  private maxSteps: number = 50;

  constructor(projectId: string, location?: string) {
    this.browserController = new BrowserController();
    this.geminiClient = new GeminiClient(projectId, location);
    this.suggestionAgent = new SuggestionAgent(projectId, location);
  }

  async executeTask(taskDescription: string, startUrl: string, taskId: string): Promise<TaskExecution> {
    this.task = {
      id: taskId,
      taskDescription,
      status: 'running',
      steps: [],
      currentScreenshot: '',
      startUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      // Navigate to start URL
      await this.browserController.navigateToUrl(startUrl);
      await this.wait(1000);

      let stepCount = 0;
      let previousContext = '';

      while (stepCount < this.maxSteps && this.task.status === 'running') {
        // Take screenshot
        const screenshot = await this.browserController.screenshot();
        this.task.currentScreenshot = screenshot.toString('base64');

        // Get AI decision
        const geminiResponse = await this.geminiClient.analyzeScreenshot(
          screenshot,
          taskDescription,
          previousContext
        );

        // Process each decision
        for (const decision of geminiResponse.decisions) {
          if (this.task.status !== 'running') break;

          const resultScreenshot = await this.browserController.screenshot();
          const step: ExecutionStep = {
            stepNumber: stepCount + 1,
            description: decision.reasoning,
            action: decision.action,
            screenshot: resultScreenshot.toString('base64'),
            reasoning: decision.reasoning,
            result: await this.browserController.executeAction(decision.action),
            timestamp: new Date(),
          };

          this.task.steps.push(step);
          this.task.updatedAt = new Date();
          stepCount++;

          // Update context for next iteration
          previousContext = `Last action: ${decision.action.type}. Response: ${step.result}`;

          // Small delay between actions
          await this.wait(500);
        }

        // Check if task is complete
        if (geminiResponse.taskComplete) {
          this.task.status = 'completed';
          break;
        }

        // Safety check
        if (stepCount >= this.maxSteps) {
          this.task.status = 'completed';
          console.log('Max steps reached');
          break;
        }
      }
    } catch (error) {
      this.task.status = 'failed';
      this.task.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('Task execution failed:', error);
    }

    // Generate suggestions if task completed or failed (always provide suggestions)
    if (this.task && (this.task.status === 'completed' || this.task.status === 'failed')) {
      try {
        const finalScreenshot = await this.browserController.screenshot();
        const taskSummary = `Completed ${this.task.steps.length} steps. Status: ${this.task.status}`;
        
        this.task.suggestions = await this.suggestionAgent.generateSuggestions(
          finalScreenshot,
          this.task.taskDescription,
          taskSummary
        );
      } catch (error) {
        console.error('Error generating suggestions:', error);
        this.task.suggestions = [];
      }
    }

    this.task.updatedAt = new Date();
    return this.task;
  }

  async analyzeWebsite(url: string): Promise<any> {
    await this.browserController.navigateToUrl(url);
    const screenshot = await this.browserController.screenshot();
    return await this.geminiClient.analyzeWebsite(screenshot, url);
  }

  getTaskStatus(): TaskExecution | undefined {
    return this.task;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
