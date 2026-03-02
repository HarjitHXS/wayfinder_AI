export interface BrowserAction {
  type: 'click' | 'type' | 'scroll' | 'navigate' | 'wait' | 'screenshot' | 'hover' | 'press';
  selector?: string;
  text?: string;
  url?: string;
  amount?: number;
  delay?: number;
  key?: string;
}

export interface AgentDecision {
  action: BrowserAction;
  reasoning: string;
  confidence: number;
}

export interface Suggestion {
  text: string;
  description?: string;
  target?: string;
  actionType?: 'click' | 'scroll' | 'type' | 'navigate';
}

export interface TaskExecution {
  id: string;
  taskDescription: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  steps: ExecutionStep[];
  currentScreenshot: string;
  error?: string;
  suggestions?: Suggestion[];
  startUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionStep {
  stepNumber: number;
  description: string;
  action: BrowserAction;
  screenshot: string;
  reasoning: string;
  result: string;
  timestamp: Date;
}

export interface GeminiResponse {
  decisions: AgentDecision[];
  summary: string;
  taskComplete: boolean;
  nextSteps?: string[];
}

export interface WebsiteAnalysis {
  url: string;
  screenshot: string;
  analysis: string;
  interactiveElements: string[];
  detectedText: string;
}
