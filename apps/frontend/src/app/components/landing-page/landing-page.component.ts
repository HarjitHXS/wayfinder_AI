import { Component, HostBinding, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.scss']
})
export class LandingPageComponent implements OnInit {
  @HostBinding('style.--scroll-y') scrollY = '0px';

  features = [
    {
      icon: '👁️',
      title: 'Visual UI Understanding',
      description: 'Interprets screens and UI elements directly from pixels, not just DOMs or APIs'
    },
    {
      icon: '🧭',
      title: 'Hands-on-Screen Actions',
      description: 'Executes clicks, typing, and navigation exactly where users intend'
    },
    {
      icon: '🧠',
      title: 'Gemini Multimodal',
      description: 'Uses Gemini to interpret screenshots and generate executable actions'
    },
    {
      icon: '🧩',
      title: 'Cross-App Workflows',
      description: 'Automates flows across multiple sites and desktop web apps'
    },
    {
      icon: '✅',
      title: 'Visual QA Ready',
      description: 'Great for UI testing, regression checks, and visual validation'
    },
    {
      icon: '☁️',
      title: 'Hosted on Google Cloud',
      description: 'Scalable agent hosting with reliable performance and security'
    }
  ];

  useCases = [
    {
      title: 'Universal Web Navigator',
      description: 'Handle any website by reading the screen and acting like a user',
      example: '"Open the settings page and update my profile picture"'
    },
    {
      title: 'Cross-Application Automator',
      description: 'Coordinate multi-step workflows across tabs, tools, and portals',
      example: '"Pull last week\'s metrics and paste them into the report"'
    },
    {
      title: 'Visual QA Testing Agent',
      description: 'Verify UI flows and visual state without brittle selectors',
      example: '"Run the checkout flow and confirm the receipt screen appears"'
    },
    {
      title: 'Device-View Interaction',
      description: 'Act on any visible interface, even when APIs are unavailable',
      example: '"Navigate the dashboard and export the CSV"'
    }
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.updateScrollPosition();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.updateScrollPosition();
  }

  private updateScrollPosition(): void {
    this.scrollY = `${window.scrollY}px`;
  }

  navigateToApp() {
    this.router.navigate(['/app']);
  }
}