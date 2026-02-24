import { BrowserAction, ExecutionStep } from '../types/index';
import browserPool from '../utils/browserPool';

export class BrowserController {
  async navigateToUrl(url: string): Promise<void> {
    await browserPool.ensurePageReady();
    const page = await browserPool.getPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  }

  async screenshot(): Promise<Buffer> {
    const page = await browserPool.getPage();
    const screenshot = await page.screenshot({ type: 'png' });
    return Buffer.from(screenshot);
  }

  async executeAction(action: BrowserAction): Promise<string> {
    const page = await browserPool.getPage();

    try {
      switch (action.type) {
        case 'click':
          if (!action.selector) throw new Error('Selector required for click action');
          await page.click(action.selector, { delay: 100 });
          return `Clicked on ${action.selector}`;

        case 'type':
          if (!action.selector || !action.text) throw new Error('Selector and text required for type action');
          await page.click(action.selector);
          await page.fill(action.selector, action.text);
          return `Typed "${action.text}" in ${action.selector}`;

        case 'scroll':
          const amount = action.amount || 500;
          await page.evaluate((scrollAmount) => {
            window.scrollBy(0, scrollAmount);
          }, amount);
          return `Scrolled by ${amount}px`;

        case 'navigate':
          if (!action.url) throw new Error('URL required for navigate action');
          await page.goto(action.url, { waitUntil: 'networkidle' });
          return `Navigated to ${action.url}`;

        case 'wait':
          const delay = action.delay || 1000;
          await page.waitForTimeout(delay);
          return `Waited for ${delay}ms`;

        case 'screenshot':
          await this.screenshot();
          return 'Screenshot taken';

        case 'hover':
          if (!action.selector) throw new Error('Selector required for hover action');
          await page.hover(action.selector);
          return `Hovered over ${action.selector}`;

        case 'press':
          if (!action.key) throw new Error('Key required for press action');
          await page.keyboard.press(action.key as any);
          return `Pressed key ${action.key}`;

        default:
          return 'Unknown action';
      }
    } catch (error) {
      throw new Error(`Failed to execute action: ${error}`);
    }
  }

  async evaluateOnPage(script: string): Promise<any> {
    const page = await browserPool.getPage();
    return await page.evaluate(script);
  }

  async getPageContent(): Promise<string> {
    const page = await browserPool.getPage();
    return await page.content();
  }
}
