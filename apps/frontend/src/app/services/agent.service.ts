import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import axios from 'axios';

export interface Step {
  stepNumber: number;
  description: string;
  action: {
    type: string;
    selector?: string;
    text?: string;
    url?: string;
  };
  result: string;
  screenshot: string;
  timestamp: string;
}

export interface Suggestion {
  text: string;
  description?: string;
  target?: string;
  actionType?: 'click' | 'scroll' | 'type' | 'navigate';
}

export interface Task {
  id: string;
  taskDescription: string;
  status: string;
  steps: Step[];
  currentScreenshot: string;
  error?: string;
  suggestions?: Suggestion[];
  startUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AgentService {
  private apiUrl = 'http://localhost:3001';
  private taskSubject = new BehaviorSubject<Task | null>(null);
  public task$ = this.taskSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  constructor() {
    this.apiUrl = (window as any).REACT_APP_API_URL || 'http://localhost:3001';
  }

  async executeTask(taskDescription: string, startUrl: string): Promise<string> {
    try {
      this.loadingSubject.next(true);
      const response = await axios.post(`${this.apiUrl}/api/agent/execute`, {
        taskDescription,
        startUrl,
      });

      const task = response.data.task;
      this.taskSubject.next(task);
      return response.data.sessionId;
    } catch (error) {
      this.loadingSubject.next(false);
      throw new Error('Failed to execute task. Make sure backend is running.');
    }
  }

  pollTaskStatus(sessionId: string): void {
    const maxAttempts = 300; // 10 minutes max with 2s interval
    let attempts = 0;
    let pollInterval = 2000; // Start with 2 seconds

    const poll = async () => {
      try {
        const response = await axios.get(`${this.apiUrl}/api/agent/status/${sessionId}`);
        this.taskSubject.next(response.data);

        if (response.data.status === 'completed' || response.data.status === 'failed') {
          this.loadingSubject.next(false);
          console.log(`[Polling] Task completed after ${attempts} attempts`);
        } else if (attempts < maxAttempts) {
          attempts++;
          
          // Exponential backoff: increase interval after 10 attempts to 3s, then 5s
          if (attempts > 20) {
            pollInterval = 5000; // 5 seconds
          } else if (attempts > 10) {
            pollInterval = 3000; // 3 seconds
          }
          
          console.log(`[Polling] Attempt ${attempts}, next in ${pollInterval}ms`);
          setTimeout(() => poll(), pollInterval);
        } else {
          // Timeout after max attempts
          this.loadingSubject.next(false);
          console.warn('[Polling] Max polling attempts reached');
        }
      } catch (error) {
        console.error('Error polling task status:', error);
      }
    };

    poll();
  }

  getTask(): Observable<Task | null> {
    return this.task$;
  }

  getLoading(): Observable<boolean> {
    return this.loading$;
  }
}
