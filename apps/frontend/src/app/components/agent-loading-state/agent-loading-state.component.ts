import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-agent-loading-state',
  templateUrl: './agent-loading-state.component.html',
  styleUrls: ['./agent-loading-state.component.scss']
})
export class AgentLoadingStateComponent {
  @Input() currentStep?: string | null;
  
  loadingMessages = [
    'Analyzing web page structure...',
    'Processing AI vision model...',
    'Computing optimal actions...',
    'Executing intelligent navigation...',
  ];
  
  currentMessage = this.loadingMessages[0];
  private messageIndex = 0;
  private messageInterval: any;
  
  ngOnInit() {
    this.rotateMessages();
  }
  
  ngOnDestroy() {
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
    }
  }
  
  private rotateMessages() {
    this.messageInterval = setInterval(() => {
      this.messageIndex = (this.messageIndex + 1) % this.loadingMessages.length;
      this.currentMessage = this.loadingMessages[this.messageIndex];
    }, 3000);
  }
}
