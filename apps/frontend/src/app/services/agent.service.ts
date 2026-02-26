import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import axios from 'axios';
import { environment } from '../../environments/environment';
import { FirebaseAuthService } from './firebase-auth.service';

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
  private apiUrl = environment.apiUrl;
  private taskSubject = new BehaviorSubject<Task | null>(null);
  public task$ = this.taskSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private taskHistorySubject = new BehaviorSubject<string[]>([]);
  public taskHistory$ = this.taskHistorySubject.asObservable();

  private currentSessionId: string | null = null;
  private eventSource: EventSource | null = null;
  // Fallback polling handle (if SSE fails)
  private pollHandle: any = null;

  constructor(private ngZone: NgZone, private authService: FirebaseAuthService) {}

  async executeTask(taskDescription: string, startUrl: string): Promise<string> {
    try {
      this.loadingSubject.next(true);

      // Attach auth token if user is signed in
      const token = await this.authService.getIdToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await axios.post(`${this.apiUrl}/api/agent/execute`, {
        taskDescription,
        startUrl,
      }, { headers });

      const task = response.data.task;
      this.currentSessionId = response.data.sessionId;
      this.taskSubject.next(task);

      // Track task in history
      const history = this.taskHistorySubject.getValue();
      this.taskHistorySubject.next([...history, taskDescription]);

      return response.data.sessionId;
    } catch (error) {
      this.loadingSubject.next(false);
      throw new Error('Failed to execute task. Make sure backend is running.');
    }
  }

  async continueTask(
    sessionId: string,
    instruction: string,
    inputs?: { email?: string; password?: string }
  ): Promise<string> {
    try {
      this.loadingSubject.next(true);

      const token = await this.authService.getIdToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await axios.post(
        `${this.apiUrl}/api/agent/continue/${sessionId}`,
        { instruction, inputs },
        { headers }
      );

      const task = response.data.task;
      this.currentSessionId = response.data.sessionId || sessionId;
      this.taskSubject.next(task);

      return this.currentSessionId || sessionId;
    } catch (error) {
      this.loadingSubject.next(false);
      throw new Error('Failed to continue task. Please sign in and try again.');
    }
  }

  /**
   * Primary: Stream task updates via Server-Sent Events.
   * Falls back to polling if SSE connection fails.
   */
  streamTaskStatus(sessionId: string): void {
    this.closeStream();

    try {
      const url = `${this.apiUrl}/api/agent/stream/${sessionId}`;
      this.eventSource = new EventSource(url);

      this.eventSource.onmessage = (event) => {
        // Run inside Angular zone so change detection picks it up
        this.ngZone.run(() => {
          try {
            const task: Task = JSON.parse(event.data);
            this.taskSubject.next(task);

            if (task.status === 'completed' || task.status === 'failed') {
              this.loadingSubject.next(false);
              this.closeStream();
            }
          } catch {
            // Ignore parse errors
          }
        });
      };

      this.eventSource.onerror = () => {
        console.warn('[AgentService] SSE connection lost, falling back to polling');
        this.closeStream();
        // Fall back to polling
        this.pollTaskStatus(sessionId);
      };
    } catch {
      // EventSource constructor failed — fall back
      this.pollTaskStatus(sessionId);
    }
  }

  /**
   * Fallback: Poll for task status via HTTP GET.
   */
  pollTaskStatus(sessionId: string): void {
    if (this.pollHandle) {
      clearTimeout(this.pollHandle);
      this.pollHandle = null;
    }

    const maxAttempts = 600;
    let attempts = 0;
    let pollInterval = 2000; // Start faster at 2s since this is fallback

    const poll = async () => {
      try {
        const response = await axios.get(`${this.apiUrl}/api/agent/status/${sessionId}`);
        this.taskSubject.next(response.data);

        if (response.data.status === 'completed' || response.data.status === 'failed') {
          this.loadingSubject.next(false);
          this.pollHandle = null;
        } else if (attempts < maxAttempts) {
          attempts++;
          if (attempts > 50) {
            pollInterval = 8000;
          } else if (attempts > 20) {
            pollInterval = 4000;
          }
          this.pollHandle = setTimeout(() => poll(), pollInterval);
        } else {
          this.loadingSubject.next(false);
          this.pollHandle = null;
        }
      } catch (error) {
        console.error('Error polling task status:', error);
      }
    };

    poll();
  }

  cancelTask(): void {
    this.closeStream();
    if (this.pollHandle) {
      clearTimeout(this.pollHandle);
      this.pollHandle = null;
    }
    this.loadingSubject.next(false);
    this.currentSessionId = null;
  }

  getTask(): Observable<Task | null> {
    return this.task$;
  }

  getLoading(): Observable<boolean> {
    return this.loading$;
  }

  getTaskHistory(): Observable<string[]> {
    return this.taskHistory$;
  }

  clearTaskHistory(): void {
    this.taskHistorySubject.next([]);
  }

  resetTask(): void {
    this.closeStream();
    if (this.pollHandle) {
      clearTimeout(this.pollHandle);
      this.pollHandle = null;
    }
    this.taskSubject.next(null);
    this.loadingSubject.next(false);
    this.currentSessionId = null;
  }

  private closeStream(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
