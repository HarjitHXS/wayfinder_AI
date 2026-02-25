import { Component, OnDestroy, OnInit } from '@angular/core';
import { AgentService, Task, Suggestion } from '../../services/agent.service';
import { UserService, UserStats, FeedbackSummary } from '../../services/user.service';
import { ThemeService, Theme } from '../../services/theme.service';
import { FirebaseAuthService, UserProfile } from '../../services/firebase-auth.service';
import { AuthModalService } from '../../services/auth-modal.service';
import { ApiService } from '../../services/api.service';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  task$: Observable<Task | null>;
  loading$: Observable<boolean>;
  theme$: Observable<Theme>;
  userProfile$: Observable<UserProfile | null>;
  sessionId: string | null = null;

  userName = '';
  nameInput = '';
  showNameModal = false;

  showFeedbackModal = false;
  feedbackRating = 0;
  feedbackComment = '';
  feedbackSubmitted = false;

  userStats: UserStats = { totalUsers: 0, totalLogins: 0 };
  feedbackSummary: FeedbackSummary = { averageRating: 0, totalRatings: 0 };

  starRange = [1, 2, 3, 4, 5];
  private taskSub?: Subscription;
  private authSub?: Subscription;
  private lastTaskStatus: string | null = null;
  sidePanel: 'logs' | 'history' = 'logs';
  historyTasks: any[] = [];
  historyLoading = false;
  historyError: string | null = null;
  private feedbackShownForSession: string | null = null;

  // 10-minute trial period for unauthenticated users
  private readonly TRIAL_DURATION = 10 * 60 * 1000; // 10 minutes
  private trialTimer: any = null;
  private isAuthenticated = false;
  showTrialExpired = false;

  constructor(
    private agentService: AgentService,
    private userService: UserService,
    private themeService: ThemeService,
    private authService: FirebaseAuthService,
    private authModalService: AuthModalService,
    private apiService: ApiService
  ) {
    this.task$ = this.agentService.getTask();
    this.loading$ = this.agentService.getLoading();
    this.theme$ = this.themeService.theme$;
    this.userProfile$ = this.authService.userProfile$;
  }

  ngOnInit(): void {
    // Track auth state
    this.authSub = this.authService.isAuthenticated().subscribe(auth => {
      this.isAuthenticated = auth;
      if (auth) {
        // Clear trial timer when user signs in
        this.clearTrialTimer();
        this.showTrialExpired = false;
      } else {
        // Start 10-minute trial timer for unauthenticated users
        this.startTrialTimer();
      }
    });

    this.taskSub = this.task$.subscribe((task) => {
      if (!task) return;

      if (this.lastTaskStatus !== task.status) {
        this.lastTaskStatus = task.status;
      }
    });
  }

  ngOnDestroy(): void {
    this.taskSub?.unsubscribe();
    this.authSub?.unsubscribe();
    this.clearTrialTimer();
  }

  async loadHistory(): Promise<void> {
    this.historyLoading = true;
    this.historyError = null;
    try {
      this.historyTasks = await this.apiService.getTaskHistory();
    } catch (error) {
      console.error('Error loading history:', error);
      this.historyError = 'Failed to load task history';
      this.historyTasks = [];
    } finally {
      this.historyLoading = false;
    }
  }

  switchPanel(panel: 'logs' | 'history'): void {
    this.sidePanel = panel;
    if (panel === 'history') {
      this.loadHistory();
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '⏳';
    }
  }

  formatHistoryDate(date: any): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  async onTaskSubmit(event: { taskDescription: string; startUrl: string }): Promise<void> {
    // Prevent task submission if trial has expired
    if (this.showTrialExpired) {
      return;
    }

    try {

      const sessionId = await this.agentService.executeTask(
        event.taskDescription,
        event.startUrl
      );
      this.sessionId = sessionId;
      this.agentService.pollTaskStatus(sessionId);
    } catch (error) {
      console.error('Error executing task:', error);
      alert('Failed to execute task. Make sure backend is running.');
    }
  }



  async submitUsername(): Promise<void> {
    const name = this.nameInput.trim();
    if (!name) return;

    try {
      this.userName = name;
      localStorage.setItem('autosteer_username', name);
      this.showNameModal = false;
      await this.loginUser();
      await this.loadStats();
    } catch (error) {
      console.error('Error logging in user:', error);
      alert('Failed to save username. Please try again.');
    }
  }

  async submitFeedback(): Promise<void> {
    if (!this.feedbackRating || !this.userName) return;

    try {
      await this.userService.submitFeedback(this.userName, this.feedbackRating, this.feedbackComment);
      this.feedbackSubmitted = true;
      this.showFeedbackModal = false;
      await this.loadStats();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    }
  }

  skipFeedback(): void {
    this.showFeedbackModal = false;
  }

  setRating(value: number): void {
    this.feedbackRating = value;
  }

  getAverageStarClass(value: number): string {
    return value <= Math.round(this.feedbackSummary.averageRating) ? 'star filled' : 'star';
  }

  getCurrentStepDescription(task: Task | null): string | null {
    if (!task || !task.steps || task.steps.length === 0) {
      return null;
    }
    return task.steps[task.steps.length - 1]?.description || null;
  }

  private async loginUser(): Promise<void> {
    if (!this.userName) return;
    await this.userService.login(this.userName);
  }

  private async loadStats(): Promise<void> {
    try {
      const [userStats, feedbackSummary] = await Promise.all([
        this.userService.getUserStats(),
        this.userService.getFeedbackSummary(),
      ]);
      this.userStats = userStats;
      this.feedbackSummary = feedbackSummary;
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  private startTrialTimer(): void {
    this.clearTrialTimer();
    this.trialTimer = setTimeout(() => {
      // Trial expired - reset everything
      this.agentService.resetTask();
      this.sessionId = null;
      this.lastTaskStatus = null;
      this.showTrialExpired = true;
    }, this.TRIAL_DURATION);
  }

  private clearTrialTimer(): void {
    if (this.trialTimer) {
      clearTimeout(this.trialTimer);
      this.trialTimer = null;
    }
  }

  dismissTrialExpired(): void {
    this.showTrialExpired = false;
  }

  openAuthModal(): void {
    this.authModalService.open();
  }

  async signOut(): Promise<void> {
    try {
      await this.authService.signOut();
      this.clearTrialTimer();
      // After signing out, restart the trial timer
      this.startTrialTimer();
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Failed to sign out. Please try again.');
    }
  }
}
