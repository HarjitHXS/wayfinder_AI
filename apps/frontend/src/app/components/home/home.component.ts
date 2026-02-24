import { Component, OnDestroy, OnInit } from '@angular/core';
import { AgentService, Task, Suggestion } from '../../services/agent.service';
import { UserService, UserStats, FeedbackSummary } from '../../services/user.service';
import { ThemeService, Theme } from '../../services/theme.service';
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
  private lastTaskStatus: string | null = null;
  private feedbackShownForSession: string | null = null;

  constructor(
    private agentService: AgentService, 
    private userService: UserService,
    private themeService: ThemeService
  ) {
    this.task$ = this.agentService.getTask();
    this.loading$ = this.agentService.getLoading();
    this.theme$ = this.themeService.theme$;
  }

  ngOnInit(): void {
    // Temporarily disabled Firebase features for UI testing
    // const storedName = localStorage.getItem('autosteer_username');
    // if (storedName) {
    //   this.userName = storedName;
    //   this.nameInput = storedName;
    //   this.loginUser();
    // } else {
    //   this.showNameModal = true;
    // }

    // this.loadStats();

    this.taskSub = this.task$.subscribe((task) => {
      if (!task) return;

      if (this.lastTaskStatus !== task.status) {
        this.lastTaskStatus = task.status;

        // Temporarily disabled feedback modal
        // if (task.status === 'completed' && this.sessionId) {
        //   if (this.feedbackShownForSession !== this.sessionId) {
        //     this.showFeedbackModal = true;
        //     this.feedbackRating = 0;
        //     this.feedbackComment = '';
        //     this.feedbackSubmitted = false;
        //     this.feedbackShownForSession = this.sessionId;
        //   }
        // }
      }
    });
  }

  ngOnDestroy(): void {
    this.taskSub?.unsubscribe();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  async onTaskSubmit(event: { taskDescription: string; startUrl: string }): Promise<void> {
    try {
      // Temporarily disabled username check
      // if (!this.userName) {
      //   this.showNameModal = true;
      //   return;
      // }

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

  onSuggestionSelected(suggestion: Suggestion): void {
    // Get current task to extract the URL
    this.task$.subscribe((task) => {
      if (task) {
        // Find the current URL from the task
        let currentUrl = 'https://google.com'; // Default fallback

        // First, try to use the stored startUrl
        if (task.startUrl) {
          currentUrl = task.startUrl;
        } else if (task.steps && task.steps.length > 0) {
          // Look for a navigate action in the steps
          for (const step of task.steps) {
            if (step.action.type === 'navigate' && step.action.url) {
              currentUrl = step.action.url;
              break;
            }
          }
        }

        // Use the suggestion text as the next task description
        const nextTaskDescription = suggestion.text;
        
        // Auto-submit the suggestion as a new task
        this.onTaskSubmit({
          taskDescription: nextTaskDescription,
          startUrl: currentUrl
        });
      }
    }).unsubscribe();
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
}
