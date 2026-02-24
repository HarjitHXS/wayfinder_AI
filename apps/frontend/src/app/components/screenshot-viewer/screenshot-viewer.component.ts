import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-screenshot-viewer',
  templateUrl: './screenshot-viewer.component.html',
  styleUrls: ['./screenshot-viewer.component.scss']
})
export class ScreenshotViewerComponent {
  @Input() screenshot: string | null = null;
  @Input() loading: boolean = false;
  @Input() taskStatus: string | null = null;
  @Input() currentStep: string | null = null;
}
