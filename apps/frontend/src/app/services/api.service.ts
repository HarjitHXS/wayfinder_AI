import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FirebaseAuthService } from './firebase-auth.service';

export interface TaskHistoryItem {
  taskId: string;
  status: 'completed' | 'failed' | 'running';
  input: {
    description: string;
    url: string;
  };
  execution?: {
    steps: any[];
    totalSteps: number;
    duration: number;
  };
  result?: {
    success: boolean;
    message: string;
  };
  metadata?: {
    costUSD: number;
  };
  createdAt: Date;
}

export interface UserSubscription {
  plan: string;
  tasksRemaining: number;
  tasksUsed: number;
  resetDate: Date;
}

export interface UserStats {
  authenticated: boolean;
  totalTasksExecuted: number;
  subscription?: UserSubscription;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = this.getApiUrl();

  constructor(
    private http: HttpClient,
    private authService: FirebaseAuthService
  ) {}

  /**
   * Get API URL from environment or use default
   */
  private getApiUrl(): string {
    // 1. Check window object for runtime configuration (injected by Docker)
    if (typeof window !== 'undefined' && (window as any).__env__ && (window as any).__env__.API_URL) {
      return (window as any).__env__.API_URL;
    }
    
    // 2. Check for config.json file (created at runtime in Cloud Run)
    // This is handled by a Promise, but for sync method we'll use localStorage as fallback
    const cachedUrl = typeof window !== 'undefined' ? localStorage.getItem('api-url') : null;
    if (cachedUrl) {
      return cachedUrl;
    }
    
    // 3. Default to current origin's backend (Cloud Run service to service will use relative paths)
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      // In production, backend and frontend are separate Cloud Run services
      // Try to detect it from the hostname pattern
      const backendUrl = window.location.origin.replace('frontend', 'backend');
      return backendUrl;
    }
    
    // 4. Development fallback
    return 'http://localhost:3001';
  }

  /**
   * Get authorization headers with Firebase token
   */
  private async getAuthHeaders(): Promise<HttpHeaders> {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    const token = await this.authService.getIdToken();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  /**
   * Verify Firebase authentication status
   */
  verifyAuth(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/auth/verify`);
  }

  /**
   * Get user stats (authenticated or not)
   */
  async getStats(): Promise<UserStats> {
    const headers = await this.getAuthHeaders();
    return this.http.get<UserStats>(`${this.apiUrl}/api/stats`, { headers }).toPromise() as Promise<UserStats>;
  }

  /**
   * Get user subscription info
   */
  async getSubscription(): Promise<UserSubscription> {
    const headers = await this.getAuthHeaders();
    return this.http.get<UserSubscription>(`${this.apiUrl}/api/auth/subscription`, { headers }).toPromise() as Promise<UserSubscription>;
  }

  /**
   * Get user's task history
   */
  async getTaskHistory(): Promise<TaskHistoryItem[]> {
    const headers = await this.getAuthHeaders();
    const response = await this.http.get<{ count: number; tasks: TaskHistoryItem[] }>(
      `${this.apiUrl}/api/agent/history`,
      { headers }
    ).toPromise();
    return response?.tasks || [];
  }

  /**
   * Get specific task details
   */
  async getTaskDetail(taskId: string): Promise<TaskHistoryItem | null> {
    const headers = await this.getAuthHeaders();
    try {
      const response = await this.http.get<TaskHistoryItem>(
        `${this.apiUrl}/api/agent/history/${taskId}`,
        { headers }
      ).toPromise();
      return response || null;
    } catch (error) {
      console.error('Error getting task detail:', error);
      return null;
    }
  }

  /**
   * Delete task from history
   */
  async deleteTask(taskId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    await this.http.delete(
      `${this.apiUrl}/api/agent/history/${taskId}`,
      { headers }
    ).toPromise();
  }

  /**
   * Get user profile
   */
  async getUserProfile(): Promise<any> {
    const headers = await this.getAuthHeaders();
    return this.http.get(`${this.apiUrl}/api/auth/profile`, { headers }).toPromise();
  }

  /**
   * Update user profile
   */
  async updateUserProfile(updates: { displayName?: string; theme?: string; notifications?: boolean }): Promise<any> {
    const headers = await this.getAuthHeaders();
    return this.http.put(`${this.apiUrl}/api/auth/profile`, updates, { headers }).toPromise();
  }

  /**
   * Execute agent task (no auth required but can be called with auth to save history)
   */
  async executeTask(taskDescription: string, startUrl: string): Promise<any> {
    const headers = await this.getAuthHeaders();
    return this.http.post(
      `${this.apiUrl}/api/agent/execute`,
      { taskDescription, startUrl },
      { headers }
    ).toPromise();
  }

  /**
   * Get task status
   */
  async getTaskStatus(sessionId: string): Promise<any> {
    return this.http.get(`${this.apiUrl}/api/agent/status/${sessionId}`).toPromise();
  }

  /**
   * Stream task updates via SSE
   */
  streamTaskUpdates(sessionId: string): Observable<any> {
    return new Observable(observer => {
      const eventSource = new EventSource(`${this.apiUrl}/api/agent/stream/${sessionId}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          observer.next(data);
        } catch (error) {
          observer.error(error);
        }
      };

      eventSource.onerror = (error) => {
        eventSource.close();
        observer.error(error);
      };

      return () => {
        eventSource.close();
      };
    });
  }
}
