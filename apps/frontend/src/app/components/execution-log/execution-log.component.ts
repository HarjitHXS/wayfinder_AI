import { Component, Input, OnChanges, OnInit, OnDestroy, SimpleChanges } from '@angular/core';
import { Step, AgentService } from '../../services/agent.service';
import { VoiceService } from '../../services/voice.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-execution-log',
  templateUrl: './execution-log.component.html',
  styleUrls: ['./execution-log.component.scss']
})
export class ExecutionLogComponent implements OnChanges, OnInit, OnDestroy {
  @Input() steps: Step[] = [];
  @Input() loading: boolean = false;
  @Input() taskDescription: string = '';
  @Input() taskStatus: string = '';
  voiceNarrationEnabled = true;

  private hasAnnouncedTask = false;
  private hasAnnouncedCompletion = false;
  private taskHistory: string[] = [];
  private historySub?: Subscription;

  constructor(
    private voiceService: VoiceService,
    private agentService: AgentService
  ) {}

  ngOnInit(): void {
    this.historySub = this.agentService.getTaskHistory().subscribe(history => {
      this.taskHistory = history;
    });
  }

  ngOnDestroy(): void {
    this.historySub?.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.voiceNarrationEnabled) return;

    // Reset flags when a new task description arrives
    if (changes['taskDescription'] && changes['taskDescription'].currentValue !== changes['taskDescription'].previousValue) {
      if (changes['taskDescription'].previousValue) {
        this.hasAnnouncedTask = false;
        this.hasAnnouncedCompletion = false;
      }
    }

    // Announce the task once when it starts running
    if (changes['taskStatus'] || changes['taskDescription']) {
      if (this.taskStatus === 'running' && this.taskDescription && !this.hasAnnouncedTask) {
        this.hasAnnouncedTask = true;
        this.hasAnnouncedCompletion = false;
        this.voiceService.speak(this.taskDescription);
      }
    }

    // Announce completion once when task finishes
    if (changes['taskStatus']) {
      if (this.taskStatus === 'completed' && !this.hasAnnouncedCompletion) {
        this.hasAnnouncedCompletion = true;
        const completionMessage = this.buildCompletionMessage();
        this.voiceService.speak(completionMessage);
      } else if (this.taskStatus === 'failed' && !this.hasAnnouncedCompletion) {
        this.hasAnnouncedCompletion = true;
        this.voiceService.speak('Task failed. Please try again.');
      }
    }
  }

  private buildCompletionMessage(): string {
    if (this.taskHistory.length <= 1) {
      return 'Task complete. What would you like to do next?';
    }

    // Summarize what was done so far
    const completed = this.taskHistory.map((t, i) => `${i + 1}. ${t}`).join('. ');
    return `Done. So far I have completed: ${completed}. What would you like to do next?`;
  }

  toggleVoiceNarration(): void {
    this.voiceNarrationEnabled = !this.voiceNarrationEnabled;
    if (!this.voiceNarrationEnabled) {
      this.voiceService.stopSpeaking();
    }
  }
}
