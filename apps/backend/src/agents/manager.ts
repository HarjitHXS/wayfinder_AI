import { BrowserController } from '../browser/controller';
import { GeminiClient } from '../gemini/client';
import { GeminiStudioClient } from '../gemini/studioClient';
import { TaskExecution, ExecutionStep, BrowserAction } from '../types/index';
import sessionManager from '../utils/sessionManager';

export class AgentManager {
  private browserController: BrowserController;
  private geminiClient: GeminiClient | GeminiStudioClient;
  private task?: TaskExecution;
  private maxSteps: number = 10;

  constructor(projectId: string = process.env.GOOGLE_CLOUD_PROJECT_ID || 'autosteer', location?: string) {
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

  async continueTask(
    existingTask: TaskExecution,
    instruction: string,
    taskId: string,
    inputs?: { email?: string; password?: string }
  ): Promise<TaskExecution> {
    this.task = existingTask;
    const initialStepCount = this.task.steps.length;
    const executedActions: string[] = this.task.steps.map(step => `${step.action.type} (${step.description})`);

    this.task.status = 'running';
    this.task.taskDescription = instruction;
    this.task.updatedAt = new Date();
    this.flush(taskId);

    try {
      console.log('[AgentManager] Continuing task on existing page');

      await this.browserController.smartWait(400);

      await this.browserController.addLabels();
      const initialScreenshot = await this.browserController.screenshot();
      this.task.currentScreenshot = initialScreenshot.toString('base64');
      await this.browserController.removeLabels();

      const sensitiveHint = this.buildSensitivePlaceholderHint(inputs);
      const continueContext = `You are continuing a task. Previous steps completed already. ` +
        `New instruction for this page: "${instruction}". ` +
        `${sensitiveHint}` +
        `Previously done: ${executedActions.join('; ') || 'nothing yet'}. ` +
        `Look at the current page in the screenshot and determine what actions are needed next to complete this instruction. ` +
        `Only return the actions needed to complete this specific instruction. If the instruction is already satisfied, return no actions.`;

      console.log('[AgentManager] API Call: Planning continuation...');
      console.log('[AgentManager] Context:', continueContext);
      let plan = await this.geminiClient.planTask(initialScreenshot, continueContext);

      if (!plan.decisions || plan.decisions.length === 0) {
        console.log('[AgentManager] Gemini returned empty plan.');
        console.log('[AgentManager] Plan summary:', plan.summary);
        this.task.status = plan.summary?.toLowerCase().includes('complete') || plan.summary?.toLowerCase().includes('done')
          ? 'completed'
          : 'failed';
        if (this.task.status === 'failed') {
          this.task.error = `AI could not create a continuation plan. ${plan.summary || 'Gemini returned no actions.'}`;
        } else {
          this.task.error = undefined;
          console.log('[AgentManager] Task already complete per Gemini');
        }
        this.flush(taskId);
        return this.task;
      }

      console.log(`[AgentManager] Continuation plan: ${plan.decisions.length} actions — ${plan.summary}`);

      let additionalSteps = 0;
      let apiCalls = 1;

      for (let i = 0; i < plan.decisions.length; i++) {
        if (additionalSteps >= this.maxSteps) {
          console.log('[AgentManager] Max continuation steps reached');
          break;
        }

        const decision = plan.decisions[i];
        console.log(`[AgentManager] Continue step ${additionalSteps + 1}: ${decision.action.type} — ${decision.reasoning}`);

        let result: string;
        let actionForLog = decision.action;
        let actionForExecution = decision.action;
        let usedSensitive = false;

        try {
          const resolved = this.resolveSensitiveAction(decision.action, inputs);
          actionForExecution = resolved.resolvedAction;
          actionForLog = resolved.loggedAction;
          usedSensitive = resolved.usedSensitive;
          result = await this.browserController.executeAction(actionForExecution);
        } catch (error: any) {
          console.log(`[AgentManager] Action failed: ${error.message}. Re-planning this step...`);

          await this.browserController.smartWait(500);
          await this.browserController.addLabels();
          const retryScreenshot = await this.browserController.screenshot();
          await this.browserController.removeLabels();

          try {
            const fix = await this.geminiClient.planTask(
              retryScreenshot,
              `The action "${decision.action.type}" on "${decision.action.selector || ''}" failed (${error.message}). ` +
              `Find the correct element to accomplish: ${decision.reasoning}. ` +
              `${sensitiveHint}` +
              `Original instruction: "${instruction}". Return only the corrective action.`
            );
            apiCalls++;

            if (fix.decisions?.[0]) {
              const resolved = this.resolveSensitiveAction(fix.decisions[0].action, inputs);
              actionForExecution = resolved.resolvedAction;
              actionForLog = resolved.loggedAction;
              usedSensitive = resolved.usedSensitive;
              result = await this.browserController.executeAction(actionForExecution);
              console.log('[AgentManager] Retry succeeded');
            } else {
              result = `Failed: ${error.message}`;
            }
          } catch {
            result = `Failed: ${error.message}`;
          }
        }

        const safeResult = usedSensitive && actionForExecution.type === 'type'
          ? this.buildRedactedTypeResult(actionForLog.selector)
          : result;

        executedActions.push(`${actionForLog.type} (${decision.reasoning})`);

        if (['click', 'navigate'].includes(actionForExecution.type)) {
          await this.browserController.smartWait(800);
        } else if (['type', 'press'].includes(actionForExecution.type)) {
          await this.browserController.smartWait(400);
        } else if (actionForExecution.type === 'scroll') {
          await this.browserController.smartWait(300);
        }

        const resultScreenshot = await this.browserController.screenshot();

        const step: ExecutionStep = {
          stepNumber: initialStepCount + additionalSteps + 1,
          description: decision.reasoning,
          action: actionForLog,
          screenshot: resultScreenshot.toString('base64'),
          reasoning: decision.reasoning,
          result: safeResult,
          timestamp: new Date(),
        };

        this.task.steps.push(step);
        this.task.currentScreenshot = resultScreenshot.toString('base64');
        this.task.updatedAt = new Date();
        additionalSteps++;

        this.flush(taskId);

        const isPageChanging = ['click', 'navigate'].includes(actionForExecution.type);
        const hasRemainingSteps = i < plan.decisions.length - 1;

        if (isPageChanging && hasRemainingSteps && apiCalls < 4) {
          console.log('[AgentManager] Page may have changed — re-planning remaining steps');

          await this.browserController.addLabels();
          const freshScreenshot = await this.browserController.screenshot();
          await this.browserController.removeLabels();

          const remainingContext = `Continue instruction: "${instruction}". ` +
            `${sensitiveHint}` +
            `Already completed: ${executedActions.join('; ')}. ` +
            `Complete the remaining steps to finish the instruction.`;

          try {
            const rePlan = await this.geminiClient.planTask(freshScreenshot, remainingContext);
            apiCalls++;

            if (rePlan.decisions?.length > 0) {
              const alreadyDone = plan.decisions.slice(0, i + 1);
              plan = { ...rePlan, decisions: [...alreadyDone, ...rePlan.decisions] };
              console.log(`[AgentManager] Re-planned: ${rePlan.decisions.length} new steps`);
            }
          } catch (err: any) {
            console.log(`[AgentManager] Re-plan failed (${err.message}), continuing with original plan`);
          }
        }
      }

      const newSteps = this.task.steps.slice(initialStepCount);
      const allSucceeded = newSteps.length > 0 && newSteps.every(s => !s.result.startsWith('Failed'));

      if (allSucceeded && plan.decisions.length <= 5) {
        this.task.status = 'completed';
        console.log('[AgentManager] Continuation succeeded — skipping verification');
      } else {
        console.log('[AgentManager] Verifying continuation...');
        const finalScreenshot = await this.browserController.screenshot();
        const verification = await this.geminiClient.verifyTaskCompletion(
          finalScreenshot,
          instruction,
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
      console.error('[AgentManager] Continuation failed:', error);
    }

    this.task.updatedAt = new Date();
    this.flush(taskId);
    console.log('[AgentManager] Continuation done');
    return this.task;
  }

  async analyzeWebsite(url: string): Promise<any> {
    await this.browserController.navigateToUrl(url);
    const screenshot = await this.browserController.screenshot();
    return await this.geminiClient.analyzeWebsite(screenshot, url);
  }

  private buildSensitivePlaceholderHint(inputs?: { email?: string; password?: string }): string {
    if (!inputs) return '';
    const keys = Object.keys(inputs).filter(key => inputs[key as keyof typeof inputs]);
    if (keys.length === 0) return '';
    const placeholders = keys.map(key => `{{${key}}}`).join(', ');
    return `If you need to type sensitive values, use placeholders: ${placeholders}. Do not include real values. `;
  }

  private resolveSensitiveAction(
    action: BrowserAction,
    inputs?: { email?: string; password?: string }
  ): { resolvedAction: BrowserAction; loggedAction: BrowserAction; usedSensitive: boolean } {
    if (!inputs || action.type !== 'type' || !action.text) {
      return { resolvedAction: action, loggedAction: action, usedSensitive: false };
    }

    let resolvedText = action.text;
    let usedSensitive = false;
    const inputValues = Object.values(inputs).filter(value => !!value) as string[];

    for (const [key, value] of Object.entries(inputs)) {
      if (!value) continue;
      const placeholder = `{{${key}}}`;
      if (resolvedText.includes(placeholder)) {
        resolvedText = resolvedText.split(placeholder).join(value);
        usedSensitive = true;
      }
    }

    const hasRawSensitive = inputValues.some(value => action.text?.includes(value));
    const shouldRedact = usedSensitive || hasRawSensitive;

    const loggedAction = shouldRedact
      ? { ...action, text: '[REDACTED]' }
      : action;

    const resolvedAction = { ...action, text: resolvedText };

    return { resolvedAction, loggedAction, usedSensitive: shouldRedact };
  }

  private buildRedactedTypeResult(selector?: string): string {
    if (selector) {
      return `Typed "[REDACTED]" in ${selector}`;
    }
    return 'Typed "[REDACTED]" in target field';
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
