import { BrowserAction, ExecutionStep } from '../types/index';
import browserPool from '../utils/browserPool';
import * as fs from 'fs';
import * as path from 'path';
import { LABEL_ELEMENTS_SCRIPT } from './scripts/labelElements';

export class BrowserController {
  private readonly defaultScreenshotQuality = 60;
  async navigateToUrl(url: string): Promise<void> {
    await browserPool.ensurePageReady();
    const page = await browserPool.getPage();
    // Use domcontentloaded for speed — networkidle stalls on heavy sites
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Best-effort wait for full load (non-blocking, 5s cap)
    await page.waitForLoadState('load', { timeout: 5000 }).catch(() => {});
  }

  async addLabels(): Promise<void> {
    await this.withPageRetry(async (page) => {
      await page.evaluate(LABEL_ELEMENTS_SCRIPT);
    }, 'addLabels');
  }

  async removeLabels(): Promise<void> {
    await this.withPageRetry(async (page) => {
      await page.evaluate(() => {
          document.querySelectorAll('.wayfinder-label').forEach(el => el.remove());
      });
    }, 'removeLabels');
  }

  async screenshot(options?: { quality?: number; fullPage?: boolean; clipToViewport?: boolean }): Promise<Buffer> {
    return await this.withPageRetry(async (page) => {
      const quality = options?.quality ?? this.defaultScreenshotQuality;
      const fullPage = options?.fullPage ?? false;
      const clipToViewport = options?.clipToViewport ?? true;
      const viewport = page.viewportSize();
      const clip = clipToViewport && !fullPage && viewport
        ? { x: 0, y: 0, width: viewport.width, height: viewport.height }
        : undefined;

      const screenshot = await page.screenshot({
          type: 'jpeg',
          quality,
          scale: 'css',
          fullPage,
          clip
      });

      return Buffer.from(screenshot);
    }, 'screenshot');
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
    try {
      return await this.withPageRetry(async (page) => {
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
          await page.evaluate((scrollAmount: number) => {
            window.scrollBy(0, scrollAmount);
          }, amount);
          return `Scrolled by ${amount}px`;

        case 'navigate':
          if (!action.url) throw new Error('URL required for navigate action');
          await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForLoadState('load', { timeout: 5000 }).catch(() => {});
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
      }, `executeAction:${action.type}`);
    } catch (error) {
      throw new Error(`Failed to execute action: ${error}`);
    }
  }

  async evaluateOnPage(script: string): Promise<any> {
    return await this.withPageRetry(async (page) => {
      return await page.evaluate(script);
    }, 'evaluateOnPage');
  }

  async getPageContent(): Promise<string> {
    return await this.withPageRetry(async (page) => {
      return await page.content();
    }, 'getPageContent');
  }

  private async withPageRetry<T>(
    action: (page: any) => Promise<T>,
    label: string
  ): Promise<T> {
    try {
      await browserPool.ensurePageReady();
      const page = await browserPool.getPage();
      return await action(page);
    } catch (error: any) {
      if (this.isPageClosedError(error)) {
        console.log(`[BrowserController] Page closed during ${label}, reinitializing...`);
        await browserPool.close();
        await browserPool.initialize();
        const page = await browserPool.getPage();
        return await action(page);
      }
      throw error;
    }
  }

  private isPageClosedError(error: any): boolean {
    const message = String(error?.message || error || '');
    return message.includes('Target page, context or browser has been closed')
      || message.includes('has been closed')
      || message.includes('browser has been closed');
  }
}
