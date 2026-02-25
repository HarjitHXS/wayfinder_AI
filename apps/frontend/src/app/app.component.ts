import { Component, OnInit, ViewChild } from '@angular/core';
import { ThemeService } from './services/theme.service';
import { AuthModalService } from './services/auth-modal.service';
import { AuthModalComponent } from './components/auth-modal/auth-modal.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  @ViewChild('authModal') authModal?: AuthModalComponent;
  
  constructor(private themeService: ThemeService, private authModalService: AuthModalService) {}

  ngOnInit() {
    // Theme service will automatically apply the stored theme
  }

  openAuthModal(): void {
    this.authModal?.open();
  }

  onAuthClosed(): void {
    // Handle auth modal closed event if needed
  }
}

