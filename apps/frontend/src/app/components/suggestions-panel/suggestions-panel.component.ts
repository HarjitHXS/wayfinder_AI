import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Suggestion } from '../../services/agent.service';

@Component({
  selector: 'app-suggestions-panel',
  templateUrl: './suggestions-panel.component.html',
  styleUrls: ['./suggestions-panel.component.scss']
})
export class SuggestionsPanelComponent {
  @Input() suggestions: Suggestion[] = [];
  @Input() loading: boolean = false;
  @Output() suggestionSelected = new EventEmitter<Suggestion>();

  getSuggestionIcon(actionType?: string): string {
    switch (actionType) {
      case 'click':
        return '🖱️';
      case 'scroll':
        return '↓';
      case 'type':
        return '⌨️';
      case 'navigate':
        return '→';
      default:
        return '💡';
    }
  }

  isValidSelector(target?: string): boolean {
    if (!target) return false;
    // Hide unhelpful CSS selectors like button[name='btnK'], input[type='search'], etc.
    const unhelpfulPatterns = [
      /^button\[name=/.test(target),
      /^input\[type=/.test(target),
      target.length < 5,
    ];
    return !unhelpfulPatterns.some(p => p);
  }

  onSuggestionClick(suggestion: Suggestion): void {
    this.suggestionSelected.emit(suggestion);
  }
}
