import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-task-form',
  templateUrl: './task-form.component.html',
  styleUrls: ['./task-form.component.scss']
})
export class TaskFormComponent implements OnChanges {
  @Input() loading: boolean = false;
  @Output() onSubmit = new EventEmitter<{ taskDescription: string; startUrl: string }>();

  form: FormGroup;

  constructor(private fb: FormBuilder) {
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
}
