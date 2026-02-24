import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { TaskFormComponent } from './components/task-form/task-form.component';
import { ScreenshotViewerComponent } from './components/screenshot-viewer/screenshot-viewer.component';
import { ExecutionLogComponent } from './components/execution-log/execution-log.component';
import { HomeComponent } from './components/home/home.component';
import { LandingPageComponent } from './components/landing-page/landing-page.component';
import { AgentIdleStateComponent } from './components/agent-idle-state/agent-idle-state.component';
import { AgentLoadingStateComponent } from './components/agent-loading-state/agent-loading-state.component';
import { ThemeToggleComponent } from './components/theme-toggle/theme-toggle.component';
import { SuggestionsPanelComponent } from './components/suggestions-panel/suggestions-panel.component';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    LandingPageComponent,
    TaskFormComponent,
    ScreenshotViewerComponent,
    ExecutionLogComponent,
    AgentIdleStateComponent,
    AgentLoadingStateComponent,
    ThemeToggleComponent,
    SuggestionsPanelComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    ReactiveFormsModule,
    FormsModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
