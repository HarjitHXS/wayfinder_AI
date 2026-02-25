import { Component, OnInit, OnDestroy } from '@angular/core';

interface Capability {
  icon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-agent-idle-state',
  templateUrl: './agent-idle-state.component.html',
  styleUrls: ['./agent-idle-state.component.scss']
})
export class AgentIdleStateComponent implements OnInit, OnDestroy {
  welcomeMessage = "Hi! I'm Wayfinder. Tell me what you'd like to do, and I'll help you navigate.";

  capabilities: Capability[] = [
    {
      icon: '🗺️',
      title: 'Find Things',
      description: 'Navigate websites easily'
    },
    {
      icon: '✅',
      title: 'Complete Tasks',
      description: 'Fill forms and click buttons'
    },
    {
      icon: '⚡',
      title: 'Work Together',
      description: 'You lead, I assist'
    }
  ];

  ngOnInit() {
    // Simple initialization
  }

  ngOnDestroy() {
    // Cleanup if needed
  }
}
