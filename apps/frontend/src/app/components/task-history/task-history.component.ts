import { Component, OnInit, ViewChild } from '@angular/core';
import { ApiService, TaskHistoryItem } from '../../services/api.service';
import { FirebaseAuthService } from '../../services/firebase-auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-task-history',
  templateUrl: './task-history.component.html',
  styleUrls: ['./task-history.component.scss']
})
export class TaskHistoryComponent implements OnInit {
  tasks: TaskHistoryItem[] = [];
  isLoading = true;
  isAuthenticated = false;
  loadError: string | null = null;

  constructor(
    private apiService: ApiService,
    private authService: FirebaseAuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadHistoryData();
  }

  private loadHistoryData(): void {
    this.authService.isAuthenticated().subscribe(async (authenticated) => {
      this.isAuthenticated = authenticated;
      this.isLoading = true;
      this.loadError = null;

      if (authenticated) {
        try {
          this.tasks = await this.apiService.getTaskHistory();
        } catch (error) {
          console.error('Error loading task history:', error);
          const status = (error as { status?: number })?.status;
          if (status === 401) {
            this.loadError = 'Please sign in again to view your task history.';
          } else if (status === 503) {
            this.loadError = 'History storage is disabled on the backend (Firebase Admin not configured).';
          } else {
            this.loadError = 'Failed to load task history. Please try again.';
          }
          this.tasks = [];
        }
      } else {
        this.tasks = [];
      }

      this.isLoading = false;
    });
  }

  openAuthModal(): void {
    // This would be implemented with a modal reference
    console.log('Open auth modal');
  }

  onAuthClosed(): void {
    this.loadHistoryData();
  }

  async deleteTask(taskId: string): Promise<void> {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      await this.apiService.deleteTask(taskId);
      this.tasks = this.tasks.filter(t => t.taskId !== taskId);
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    }
  }

  viewDetails(taskId: string): void {
    this.router.navigate(['/history', taskId]);
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      case 'running':
        return '⏳';
      default:
        return '❓';
    }
  }

  formatDate(date: any): string {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDuration(seconds?: number): string {
    if (!seconds) return '-';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}m ${secs}s`;
  }
}
