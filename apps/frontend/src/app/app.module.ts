import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { firebaseConfig } from '../environments/firebase.config';
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
import { AuthModalComponent } from './components/auth-modal/auth-modal.component';
import { TaskHistoryComponent } from './components/task-history/task-history.component';

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
    AuthModalComponent,
    TaskHistoryComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,
    BrowserAnimationsModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    AppRoutingModule
  ],
  providers: [
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideAuth(() => getAuth())
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
