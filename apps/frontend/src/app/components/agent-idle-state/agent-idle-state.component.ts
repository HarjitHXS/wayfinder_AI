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
  displayText = '';
  fullText = "I'm an AI agent that understands web interfaces and can navigate them for you. Tell me what you want to accomplish, and I'll handle the complex interactions while you focus on what matters.";
  currentIndex = 0;
  typingSpeed = 45; // milliseconds per character
  private typingInterval: any;
  showCursor = true;
  private cursorInterval: any;

  capabilities: Capability[] = [
    {
      icon: '🎯',
      title: 'Smart Navigation',
      description: 'I understand web layouts and can find what you need'
    },
    {
      icon: '🤖',
      title: 'Automated Actions',
      description: 'Fill forms, click buttons, and complete tasks for you'
    },
    {
      icon: '🧠',
      title: 'Context Aware',
      description: 'I learn from each interaction to serve you better'
    },
    {
      icon: '⚡',
      title: 'Real-time Help',
      description: 'Get instant assistance with any web interface'
    }
  ];

  ngOnInit() {
    this.startTyping();
    this.startCursorBlink();
  }

  ngOnDestroy() {
    if (this.typingInterval) {
      clearInterval(this.typingInterval);
    }
    if (this.cursorInterval) {
      clearInterval(this.cursorInterval);
    }
  }

  private startTyping() {
    this.typingInterval = setInterval(() => {
      if (this.currentIndex < this.fullText.length) {
        this.displayText += this.fullText.charAt(this.currentIndex);
        this.currentIndex++;
      } else {
        clearInterval(this.typingInterval);
      }
    }, this.typingSpeed);
  }

  private startCursorBlink() {
    this.cursorInterval = setInterval(() => {
      this.showCursor = !this.showCursor;
    }, 530);
  }
}
