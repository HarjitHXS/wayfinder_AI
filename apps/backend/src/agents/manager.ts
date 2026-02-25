import { BrowserController } from '../browser/controller';
import { GeminiClient } from '../gemini/client';
import { GeminiStudioClient } from '../gemini/studioClient';
import { TaskExecution, ExecutionStep } from '../types/index';
import sessionManager from '../utils/sessionManager';

export class AgentManager {
  private browserController: BrowserController;
  private geminiClient: GeminiClient | GeminiStudioClient;
  private task?: TaskExecution;
  private maxSteps: number = 10;

  constructor(projectId: string, location?: string) {
    this.browserController = new BrowserController();

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (apiKey) {
      console.log('[AgentManager] Using Google AI Studio');
      this.geminiClient = new GeminiStudioClient(apiKey);
    } else {
      console.log('[AgentManager] Using Vertex AI');
      this.geminiClient = new GeminiClient(projectId, location);
    }
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
      console.log('[AgentManager] Starting adaptive plan-execute approach');

      // ── Navigate ──────────────────────────────────────
      await this.browserController.navigateToUrl(startUrl);
      // Smart wait instead of hardcoded 1500ms
      await this.browserController.smartWait(800);

      // ── Plan (API Call #1) ────────────────────────────
      await this.browserController.addLabels();
      const initialScreenshot = await this.browserController.screenshot();
      this.task.currentScreenshot = initialScreenshot.toString('base64');
      await this.browserController.removeLabels();

      console.log('[AgentManager] API Call #1: Planning task...');
      let plan = await this.geminiClient.planTask(initialScreenshot, taskDescription);

      if (!plan.decisions || plan.decisions.length === 0) {
        this.task.status = 'failed';
        this.task.error = 'AI could not create a plan for this task';
        this.flush(taskId);
        return this.task;
      }

      console.log(`[AgentManager] Plan: ${plan.decisions.length} actions — ${plan.summary}`);

      // ── Execute with adaptive re-planning ─────────────
      const executedActions: string[] = [];
      let stepCount = 0;
      let apiCalls = 1; // Already used 1 for planning

      for (let i = 0; i < plan.decisions.length; i++) {
        if (stepCount >= this.maxSteps) {
          console.log('[AgentManager] Max steps reached');
          break;
        }

        const decision = plan.decisions[i];
        console.log(`[AgentManager] Step ${stepCount + 1}: ${decision.action.type} — ${decision.reasoning}`);

        // ── Execute action (with retry on failure) ──────
        let result: string;
        try {
          result = await this.browserController.executeAction(decision.action);
        } catch (error: any) {
          console.log(`[AgentManager] Action failed: ${error.message}. Re-planning this step...`);

          // Take fresh screenshot and ask Gemini for a corrected action
          await this.browserController.smartWait(500);
          await this.browserController.addLabels();
          const retryScreenshot = await this.browserController.screenshot();
          await this.browserController.removeLabels();

          try {
            const fix = await this.geminiClient.planTask(retryScreenshot,
              `The action "${decision.action.type}" on "${decision.action.selector || ''}" failed (${error.message}). ` +
              `Find the correct element to accomplish: ${decision.reasoning}. ` +
              `Original task: "${taskDescription}". Return only the corrective action.`
            );
            apiCalls++;

            if (fix.decisions?.[0]) {
              result = await this.browserController.executeAction(fix.decisions[0].action);
              console.log('[AgentManager] Retry succeeded');
            } else {
              // Could not recover — record failure and continue
              result = `Failed: ${error.message}`;
            }
          } catch {
            result = `Failed: ${error.message}`;
          }
        }

        executedActions.push(`${decision.action.type} (${decision.reasoning})`);

        // ── Smart wait based on action type ─────────────
        if (['click', 'navigate'].includes(decision.action.type)) {
          await this.browserController.smartWait(800);
        } else if (['type', 'press'].includes(decision.action.type)) {
          await this.browserController.smartWait(400);
        } else if (decision.action.type === 'scroll') {
          await this.browserController.smartWait(300);
        }

        // ── Capture result screenshot ───────────────────
        const resultScreenshot = await this.browserController.screenshot();

        const step: ExecutionStep = {
          stepNumber: stepCount + 1,
          description: decision.reasoning,
          action: decision.action,
          screenshot: resultScreenshot.toString('base64'),
          reasoning: decision.reasoning,
          result,
          timestamp: new Date(),
        };

        this.task.steps.push(step);
        this.task.currentScreenshot = resultScreenshot.toString('base64');
        this.task.updatedAt = new Date();
        stepCount++;

        // Flush to session store so SSE/polling picks it up immediately
        this.flush(taskId);

        // ── Adaptive re-plan after page-changing actions ─
        const isPageChanging = ['click', 'navigate'].includes(decision.action.type);
        const hasRemainingSteps = i < plan.decisions.length - 1;

        if (isPageChanging && hasRemainingSteps && apiCalls < 4) {
          console.log('[AgentManager] Page may have changed — re-planning remaining steps');

          await this.browserController.addLabels();
          const freshScreenshot = await this.browserController.screenshot();
          await this.browserController.removeLabels();

          const remainingContext = `Continue task: "${taskDescription}". ` +
            `Already completed: ${executedActions.join('; ')}. ` +
            `Complete the remaining steps to finish the task.`;

          try {
            const rePlan = await this.geminiClient.planTask(freshScreenshot, remainingContext);
            apiCalls++;

            if (rePlan.decisions?.length > 0) {
              // Replace remaining steps with fresh plan
              const alreadyDone = plan.decisions.slice(0, i + 1);
              plan = { ...rePlan, decisions: [...alreadyDone, ...rePlan.decisions] };
              console.log(`[AgentManager] Re-planned: ${rePlan.decisions.length} new steps`);
            }
          } catch (err: any) {
            console.log(`[AgentManager] Re-plan failed (${err.message}), continuing with original plan`);
          }
        }
      }

      // ── Verify (conditional) ──────────────────────────
      const allSucceeded = this.task.steps.every(s => !s.result.startsWith('Failed'));

      if (allSucceeded && plan.decisions.length <= 5) {
        // Simple task, all steps passed — assume success
        this.task.status = 'completed';
        console.log('[AgentManager] All steps succeeded — skipping verification');
      } else {
        // Complex or partially failed — verify with Gemini
        console.log('[AgentManager] Verifying task completion...');
        const finalScreenshot = await this.browserController.screenshot();
        const verification = await this.geminiClient.verifyTaskCompletion(
          finalScreenshot,
          taskDescription,
          executedActions
        );
        apiCalls++;

        this.task.status = verification.completed ? 'completed' : 'failed';
        console.log(`[AgentManager] Verification: ${verification.completed ? 'completed' : 'incomplete'} — ${verification.summary}`);

        if (this.task.steps.length > 0) {
          this.task.steps[this.task.steps.length - 1].result += `\n\nVerification: ${verification.summary}`;
        }
      }

    } catch (error) {
      this.task.status = 'failed';
      this.task.error = error instanceof Error ? error.message : 'Unknown error';
      console.error('[AgentManager] Task execution failed:', error);
    }

    if (this.task) {
      this.task.suggestions = [];
    }

    this.task.updatedAt = new Date();
    this.flush(taskId);
    console.log(`[AgentManager] Done. Total API calls: ${this.task.status}`);
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

  /** Push current task state to session store for real-time streaming */
  private flush(taskId: string): void {
    if (this.task) {
      sessionManager.updateSession(taskId, this.task);
    }
  }
}
