# Reactive Theming System

This Angular application now includes a comprehensive reactive theming system that instantly switches between light and dark modes across all components.

## Features

- **Instant Theme Switching**: All components update immediately when theme changes
- **Persistent Storage**: Theme preference is saved to localStorage
- **CSS Custom Properties**: Uses CSS variables for consistent theming
- **Reactive Service**: Observable-based theme service for component reactivity
- **Reusable Components**: Theme toggle component can be used anywhere

## Usage

### Theme Service

```typescript
import { ThemeService } from './services/theme.service';

constructor(private themeService: ThemeService) {}

// Toggle between light and dark
this.themeService.toggleTheme();

// Set specific theme
this.themeService.setTheme('light');
this.themeService.setTheme('dark');

// Get current theme
const currentTheme = this.themeService.getCurrentTheme();

// Subscribe to theme changes
this.themeService.theme$.subscribe(theme => {
  console.log('Theme changed to:', theme);
});
```

### Theme Toggle Component

```html
<app-theme-toggle></app-theme-toggle>
```

### CSS Custom Properties

All components now use CSS custom properties that automatically update:

```scss
.my-component {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  transition: var(--transition);
}
```

## Available CSS Variables

### Colors
- `--bg-primary`: Main background color
- `--bg-secondary`: Secondary background color  
- `--bg-tertiary`: Tertiary background color
- `--text-primary`: Primary text color
- `--text-secondary`: Secondary text color
- `--text-muted`: Muted text color
- `--border-color`: Main border color
- `--border-light`: Light border color
- `--shadow`: Box shadow color
- `--hover-bg`: Hover background color

### Transitions
- `--transition`: Standard transition for smooth theme changes

## Theme Values

### Light Theme
- Background: White (#ffffff)
- Text: Black (#000000)
- Borders: Light gray tones

### Dark Theme  
- Background: Black (#000000)
- Text: White (#ffffff)
- Borders: Dark gray tones

## Implementation Notes

- Theme is applied to document.body with CSS classes (`light-theme`, `dark-theme`)
- CSS custom properties are updated via JavaScript for instant reactivity
- All existing components have been updated to use the new system
- Theme preference persists across browser sessions
- Default theme is dark mode