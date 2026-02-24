/* 
 * WAYFINDER AI - Voice-Enhanced Task Form
 * Copy this code to: frontend/src/app/components/task-form/task-form.component.ts
 * 
 * Changes from current version:
 * 1. Inject VoiceService
 * 2. Add voice input button and logic
 * 3. Add isRecording state
 */

import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { VoiceService } from '../../services/voice.service';  // ADD THIS IMPORT

@Component({
  selector: 'app-task-form',
  templateUrl: './task-form.component.html',
  styleUrls: ['./task-form.component.scss']
})
export class TaskFormComponent implements OnChanges {
  @Input() loading: boolean = false;
  @Output() onSubmit = new EventEmitter<{ startUrl: string; taskDescription: string }>();

  form: FormGroup;
  isRecording = false;  // ADD THIS

  constructor(
    private fb: FormBuilder,
    private voiceService: VoiceService  // ADD THIS
  ) {
    this.form = this.fb.group({
      startUrl: ['', [
        Validators.required,
        Validators.pattern(/^https?:\/\/.+/)
      ]],
      taskDescription: ['', [
        Validators.required,
        Validators.minLength(5)
      ]]
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['loading']) {
      if (this.loading) {
        this.form.disable();
      } else {
        this.form.enable();
      }
    }
  }

  submit() {
    if (this.form.valid) {
      this.onSubmit.emit(this.form.value);
    }
  }

  // ADD THESE METHODS
  toggleVoiceInput() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  private startRecording() {
    this.voiceService.startListening(
      (transcript: string, isFinal: boolean) => {
        // Update the task description with voice input
        this.form.patchValue({ taskDescription: transcript });
        
        if (isFinal) {
          this.stopRecording();
          // Optional: speak confirmation
          this.voiceService.speak("Got it! I'll help you with that.");
        }
      },
      () => {
        // Called when recording ends
        this.isRecording = false;
      }
    );
    this.isRecording = true;
  }

  private stopRecording() {
    this.voiceService.stopListening();
    this.isRecording = false;
  }

  get canUseVoice(): boolean {
    return this.voiceService.isSpeechRecognitionAvailable();
  }
}
