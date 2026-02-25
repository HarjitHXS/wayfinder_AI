import { Component, EventEmitter, Output, OnInit, OnDestroy } from '@angular/core';
import { FirebaseAuthService } from '../../services/firebase-auth.service';
import { AuthModalService } from '../../services/auth-modal.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-auth-modal',
  template: `
    <div class="auth-modal-overlay" *ngIf="isOpen" (click)="onBackdropClick()">
      <div class="auth-modal-content" (click)="$event.stopPropagation()">
        <button class="close-btn" (click)="close()">×</button>
        
        <h2>Sign In to Wayfinder AI</h2>
        
        <p class="subtitle">Sign in with your Google account to get started</p>
        
        <button class="btn btn-google" (click)="signInWithGoogle()" [disabled]="isLoading">
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z" fill="#34A853"/>
            <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
          </svg>
          <span>{{ isLoading ? 'Signing in...' : 'Sign in with Google' }}</span>
        </button>

        <div *ngIf="error" class="error-message">
          {{ error }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .auth-modal-content {
      background: #ffffff;
      border-radius: 16px;
      padding: 40px;
      max-width: 440px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
      position: relative;
      animation: slideUp 0.3s ease-out;
    }

    @media (max-width: 600px) {
      .auth-modal-content {
        padding: 24px 20px;
        border-radius: 12px;
        width: 95%;
      }
      h2 { font-size: 20px; }
      .subtitle { font-size: 13px; margin-bottom: 24px; }
      .btn-google { padding: 12px 18px; font-size: 14px; gap: 10px; }
      .close-btn { font-size: 26px; width: 34px; height: 34px; top: 12px; right: 12px; }
    }

    @media (max-width: 380px) {
      .auth-modal-content {
        padding: 20px 16px;
        border-radius: 10px;
      }
      h2 { font-size: 18px; }
      .subtitle { font-size: 12px; }
      .btn-google { padding: 10px 14px; font-size: 13px; }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .close-btn {
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      font-size: 32px;
      line-height: 1;
      cursor: pointer;
      color: #5f6368;
      padding: 4px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s;
    }

    .close-btn:hover {
      background: #f1f3f4;
      color: #202124;
    }

    h2 {
      margin: 0 0 12px 0;
      font-size: 26px;
      font-weight: 600;
      color: #202124;
      text-align: center;
    }

    .subtitle {
      margin: 0 0 32px 0;
      font-size: 15px;
      color: #5f6368;
      text-align: center;
      line-height: 1.5;
    }

    .btn-google {
      width: 100%;
      padding: 14px 24px;
      border: 1px solid #dadce0;
      background: #fff;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 500;
      color: #3c4043;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      transition: all 0.2s;
    }

    .btn-google:hover:not(:disabled) {
      border-color: #4285f4;
      background: #f8f9fa;
      box-shadow: 0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15);
    }

    .btn-google:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-google svg {
      flex-shrink: 0;
    }

    .error-message {
      margin-top: 20px;
      padding: 12px 16px;
      background: #fce8e6;
      border-left: 4px solid #d93025;
      border-radius: 4px;
      color: #d93025;
      font-size: 14px;
      line-height: 1.5;
    }
  `]
})
export class AuthModalComponent implements OnInit, OnDestroy {
  @Output() closed = new EventEmitter<void>();

  isOpen = false;
  isLoading = false;
  error = '';

  private subscription?: Subscription;

  constructor(
    private authService: FirebaseAuthService,
    private authModalService: AuthModalService
  ) {}

  ngOnInit(): void {
    this.subscription = this.authModalService.isOpen$.subscribe(isOpen => {
      this.isOpen = isOpen;
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  open(): void {
    this.authModalService.open();
    this.error = '';
  }

  close(): void {
    this.authModalService.close();
    this.closed.emit();
  }

  onBackdropClick(): void {
    this.close();
  }

  async signInWithGoogle(): Promise<void> {
    this.isLoading = true;
    this.error = '';
    try {
      await this.authService.signInWithGoogle();
      this.close();
    } catch (error: any) {
      this.error = error.message || 'Failed to sign in with Google';
    } finally {
      this.isLoading = false;
    }
  }
}
