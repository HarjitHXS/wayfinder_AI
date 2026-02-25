import { BrowserAction, ExecutionStep } from '../types/index';
import browserPool from '../utils/browserPool';
import * as fs from 'fs';
import * as path from 'path';
import { LABEL_ELEMENTS_SCRIPT } from './scripts/labelElements';

export class BrowserController {
  async navigateToUrl(url: string): Promise<void> {
    await browserPool.ensurePageReady();
    const page = await browserPool.getPage();
    // Use domcontentloaded for speed — networkidle stalls on heavy sites
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    // Best-effort wait for full load (non-blocking, 3s cap)
    await page.waitForLoadState('load', { timeout: 3000 }).catch(() => {});
  }

  async addLabels(): Promise<void> {
    const page = await browserPool.getPage();
    await page.evaluate(LABEL_ELEMENTS_SCRIPT);
  }

  async removeLabels(): Promise<void> {
    const page = await browserPool.getPage();
    await page.evaluate(() => {
        document.querySelectorAll('.wayfinder-label').forEach(el => el.remove());
    });
  }

  async screenshot(): Promise<Buffer> {
    const page = await browserPool.getPage();

    const screenshot = await page.screenshot({
        type: 'jpeg',
        quality: 70,  // Slightly lower for faster transfer + less tokens
        scale: 'css'
    });

    return Buffer.from(screenshot);
  }

  /**
   * Smart wait: resolves as soon as the network quiets OR after maxMs — whichever is first.
   */
  async smartWait(maxMs: number = 500): Promise<void> {
    const page = await browserPool.getPage();
    await Promise.race([
      page.waitForLoadState('networkidle', { timeout: maxMs }).catch(() => {}),
      new Promise(resolve => setTimeout(resolve, maxMs)),
    ]);
  }

  /**
   * Check whether a selector exists on the current page.
   */
  async elementExists(selector: string): Promise<boolean> {
    const page = await browserPool.getPage();
    const el = await page.$(selector);
    return el !== null;
  }

  async executeAction(action: BrowserAction): Promise<string> {
    const page = await browserPool.getPage();

    try {
      switch (action.type) {
        case 'click':
          if (!action.selector) throw new Error('Selector required for click action');
          // Verify element exists before clicking (3s timeout)
          await page.waitForSelector(action.selector, { timeout: 3000 }).catch(() => null);
          const clickEl = await page.$(action.selector);
          if (!clickEl) throw new Error(`Element not found: ${action.selector}`);
          await clickEl.click({ delay: 50, force: true });
          return `Clicked on ${action.selector}`;

        case 'type':
          if (!action.selector || !action.text) throw new Error('Selector and text required for type action');
          await page.waitForSelector(action.selector, { timeout: 3000 }).catch(() => null);
          const typeEl = await page.$(action.selector);
          if (!typeEl) throw new Error(`Element not found: ${action.selector}`);
          await typeEl.click();
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
          await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.waitForLoadState('load', { timeout: 3000 }).catch(() => {});
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
          await page.waitForSelector(action.selector, { timeout: 3000 }).catch(() => null);
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
