import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'app-theme';
  private themeSubject = new BehaviorSubject<Theme>(this.getStoredTheme());
  
  public theme$ = this.themeSubject.asObservable();

  constructor() {
    this.applyTheme(this.themeSubject.value);
  }

  private getStoredTheme(): Theme {
    const stored = localStorage.getItem(this.THEME_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    // Default to dark theme
    return 'dark';
  }

  public setTheme(theme: Theme): void {
    localStorage.setItem(this.THEME_KEY, theme);
    this.themeSubject.next(theme);
    this.applyTheme(theme);
  }

  public toggleTheme(): void {
    const currentTheme = this.themeSubject.value;
    const newTheme: Theme = currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  public getCurrentTheme(): Theme {
    return this.themeSubject.value;
  }

  private applyTheme(theme: Theme): void {
    const body = document.body;

    // Remove existing theme classes
    body.classList.remove('light-theme', 'dark-theme', 'light-bg');

    // Add new theme class
    body.classList.add(`${theme}-theme`);
    if (theme === 'light') {
      body.classList.add('light-bg');
    }

    // Update CSS custom properties for instant reactivity
    const root = document.documentElement;

    if (theme === 'light') {
      root.style.setProperty('--bg-primary', '#f0f4f8');
      root.style.setProperty('--bg-secondary', '#e4eaf2');
      root.style.setProperty('--bg-tertiary', '#d5dee9');
      root.style.setProperty('--text-primary', '#0d1117');
      root.style.setProperty('--text-secondary', '#2d3748');
      root.style.setProperty('--text-muted', '#718096');
      root.style.setProperty('--border-color', 'rgba(0,0,0,0.1)');
      root.style.setProperty('--border-light', 'rgba(0,0,0,0.06)');
      root.style.setProperty('--shadow', 'rgba(0,0,0,0.12)');
      root.style.setProperty('--hover-bg', 'rgba(0,0,0,0.04)');
      root.style.setProperty('--glass-bg', 'rgba(255,255,255,0.55)');
      root.style.setProperty('--glass-bg-hover', 'rgba(255,255,255,0.75)');
      root.style.setProperty('--glass-border', 'rgba(0,0,0,0.1)');
      root.style.setProperty('--glass-border-hover', 'rgba(0,0,0,0.18)');
      root.style.setProperty('--glass-shadow', '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.8)');
    } else {
      root.style.setProperty('--bg-primary', '#07080d');
      root.style.setProperty('--bg-secondary', '#111318');
      root.style.setProperty('--bg-tertiary', '#1c1e26');
      root.style.setProperty('--text-primary', '#f0f2ff');
      root.style.setProperty('--text-secondary', '#c8ccdd');
      root.style.setProperty('--text-muted', '#6b7194');
      root.style.setProperty('--border-color', 'rgba(255,255,255,0.08)');
      root.style.setProperty('--border-light', 'rgba(255,255,255,0.05)');
      root.style.setProperty('--shadow', 'rgba(0,0,0,0.6)');
      root.style.setProperty('--hover-bg', 'rgba(255,255,255,0.04)');
      root.style.setProperty('--glass-bg', 'rgba(255,255,255,0.04)');
      root.style.setProperty('--glass-bg-hover', 'rgba(255,255,255,0.07)');
      root.style.setProperty('--glass-border', 'rgba(255,255,255,0.1)');
      root.style.setProperty('--glass-border-hover', 'rgba(255,255,255,0.18)');
      root.style.setProperty('--glass-shadow', '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)');
    }
  }
}