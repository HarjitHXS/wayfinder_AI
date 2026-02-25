import { Component, Input, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-agent-loading-state',
  templateUrl: './agent-loading-state.component.html',
  styleUrls: ['./agent-loading-state.component.scss']
})
export class AgentLoadingStateComponent implements OnInit, OnDestroy {
  @Input() currentStep?: string | null;
  
  ngOnInit() {
    // Simple initialization
  }
  
  ngOnDestroy() {
    // Cleanup if needed
  }
}
