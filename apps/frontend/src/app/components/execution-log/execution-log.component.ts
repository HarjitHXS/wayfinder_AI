import { Component, Input } from '@angular/core';
import { Step } from '../../services/agent.service';

@Component({
  selector: 'app-execution-log',
  templateUrl: './execution-log.component.html',
  styleUrls: ['./execution-log.component.scss']
})
export class ExecutionLogComponent {
  @Input() steps: Step[] = [];
  @Input() loading: boolean = false;
}
