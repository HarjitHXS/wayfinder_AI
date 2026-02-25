import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { VoiceService } from '../../services/voice.service';

@Component({
  selector: 'app-task-form',
  templateUrl: './task-form.component.html',
  styleUrls: ['./task-form.component.scss']
})
export class TaskFormComponent implements OnChanges {
  @Input() loading: boolean = false;
  @Output() onSubmit = new EventEmitter<{ taskDescription: string; startUrl: string }>();
  @Output() onStop = new EventEmitter<void>();

  form: FormGroup;
  isRecording = false;
  isTranscribing = false;
  voiceError: string | null = null;

  constructor(private fb: FormBuilder, private voiceService: VoiceService) {
    this.form = this.fb.group({
      startUrl: ['https://google.com', [Validators.required, Validators.pattern('https?://.+')]],
      taskDescription: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['loading'] && this.form) {
      if (this.loading) {
        this.form.disable();
      } else {
        this.form.enable();
      }
    }
  }

  submit(): void {
    if (this.form.valid) {
      this.onSubmit.emit({
        taskDescription: this.form.value.taskDescription,
        startUrl: this.form.value.startUrl
      });
    }
  }

  stop(): void {
    this.onStop.emit();
  }

  get canUseVoice(): boolean {
    return !!(navigator.mediaDevices && (window as any).MediaRecorder);
  }

  async toggleVoiceInput(): Promise<void> {
    this.voiceError = null;
    if (this.isRecording) {
      await this.stopRecordingAndTranscribe();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording(): Promise<void> {
    try {
      await this.voiceService.startRecording();
      this.isRecording = true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.voiceError = 'Microphone permission denied or unavailable.';
      this.isRecording = false;
    }
  }

  private async stopRecordingAndTranscribe(): Promise<void> {
    try {
      this.isTranscribing = true;
      const audioBlob = await this.voiceService.stopRecording();
      const transcript = await this.voiceService.transcribeAudio(audioBlob);
      const current = this.form.value.taskDescription || '';
      const nextValue = current ? `${current} ${transcript}`.trim() : transcript;
      this.form.patchValue({ taskDescription: nextValue });
      if (transcript) {
        await this.voiceService.speak('Got it.');
      }
    } catch (error) {
      console.error('Failed to transcribe audio:', error);
      this.voiceError = 'Could not transcribe. Please try again.';
    } finally {
      this.isRecording = false;
      this.isTranscribing = false;
    }
  }
}
