/*
 * WAYFINDER AI - Voice-Narrated Execution Log
 * Copy this to: frontend/src/app/components/execution-log/execution-log.component.ts
 * 
 * Changes:
 * 1. Inject VoiceService
 * 2. Speak each new step as it appears
 * 3. Add toggle for voice narration
 */

import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { VoiceService } from '../../services/voice.service';

interface ExecutionStep {
  stepNumber: number;
  description: string;
  action: any;
  result: string;
  screenshot: string;
  timestamp: Date;
}

@Component({
  selector: 'app-execution-log',
  templateUrl: './execution-log.component.html',
  styleUrls: ['./execution-log.component.scss']
})
export class ExecutionLogComponent implements OnChanges {
  @Input() steps: ExecutionStep[] = [];
  @Input() status: 'idle' | 'running' | 'completed' | 'failed' = 'idle';
  
  voiceNarrationEnabled = true;  // ADD THIS
  private lastNarratedStep = 0;  // ADD THIS

  constructor(private voiceService: VoiceService) {}  // ADD THIS

  ngOnChanges(changes: SimpleChanges) {
    // Narrate new steps automatically
    if (changes['steps'] && this.steps && this.voiceNarrationEnabled) {
      this.narrateNewSteps();
    }
  }

  // ADD THIS METHOD
  private narrateNewSteps() {
    const newSteps = this.steps.slice(this.lastNarratedStep);
    
    newSteps.forEach((step, index) => {
      // Add slight delay between narrations
      setTimeout(() => {
        const narrative = this.createNarrative(step);
        this.voiceService.speak(narrative, 1.15); // Slightly faster
      }, index * 500); // 500ms between narrations
    });
    
    this.lastNarratedStep = this.steps.length;
  }

  // ADD THIS METHOD
  private createNarrative(step: ExecutionStep): string {
    const action = step.action;
    
    switch (action.type) {
      case 'click':
        return `I'm clicking on ${this.simplifySelector(action.selector || 'element')}`;
      
      case 'type':
        return `I'll type "${action.value}" into the ${this.simplifySelector(action.selector || 'field')}`;
      
      case 'navigate':
        return `Navigating to ${this.simplifyUrl(action.url)}`;
      
      case 'scroll':
        return action.direction === 'down' ? 'Scrolling down' : 'Scrolling up';
      
      case 'wait':
        return 'Waiting for the page to load';
      
      case 'screenshot':
        return 'Taking a screenshot';
      
      default:
        return step.description || `Performing ${action.type}`;
    }
  }

  // ADD THIS METHOD
  private simplifySelector(selector: string): string {
    // Remove technical CSS selector notation
    if (selector.includes('#')) {
      const id = selector.split('#')[1]?.split(/[.\s]/)[0];
      return id ? `the ${id} field` : 'this element';
    }
    if (selector.includes('button')) return 'this button';
    if (selector.includes('input')) return 'this input';
    if (selector.includes('link') || selector.startsWith('a')) return 'this link';
    
    // Extract meaningful text from selector
    const cleaned = selector.replace(/[#.>[\]]/g, ' ').trim();
    return cleaned || 'this element';
  }

  // ADD THIS METHOD
  private simplifyUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  // ADD THIS METHOD
  toggleVoiceNarration() {
    this.voiceNarrationEnabled = !this.voiceNarrationEnabled;
    if (!this.voiceNarrationEnabled) {
      this.voiceService.stopSpeaking();
    }
  }

  // ADD THIS METHOD
  replayNarration(step: ExecutionStep) {
    const narrative = this.createNarrative(step);
    this.voiceService.speak(narrative);
  }

  getActionTypeClass(actionType: string): string {
    const typeMap: {[key: string]: string} = {
      'click': 'action-click',
      'type': 'action-type',
      'navigate': 'action-navigate',
      'scroll': 'action-scroll',
      'wait': 'action-wait'
    };
    return typeMap[actionType] || 'action-default';
  }

  formatTimestamp(timestamp: Date): string {
    return new Date(timestamp).toLocaleTimeString();
  }
}
