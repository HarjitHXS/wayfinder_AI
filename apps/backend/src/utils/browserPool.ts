import { chromium, Browser, Page } from 'playwright';

class BrowserPool {
  private static instance: BrowserPool;
  private browser?: Browser;
  private page?: Page;
  private initialized = false;

  private constructor() {}

  static getInstance(): BrowserPool {
    if (!BrowserPool.instance) {
      BrowserPool.instance = new BrowserPool();
    }
    return BrowserPool.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized && this.browser) return;

    try {
      console.log('[BrowserPool] Initializing shared browser...');

      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });

      this.page = await this.browser.newPage();
      await this.page.setViewportSize({ width: 1280, height: 720 });
      this.initialized = true;
      console.log('[BrowserPool] ✅ Browser initialized');
    } catch (error) {
      console.error('[BrowserPool] Failed to initialize:', error);
      throw error;
    }
  }

  async getPage(): Promise<Page> {
    if (!this.page || !this.browser) {
      console.log('[BrowserPool] Browser disconnected or not initialized, reinitializing...');
      await this.initialize();
    }
    if (!this.page) throw new Error('Browser not initialized. Call initialize() first');
    return this.page;
  }

  async ensurePageReady(): Promise<void> {
    try {
      const page = await this.getPage();
      // Test if page is responsive
      await page.evaluate(() => true);
    } catch (error) {
      console.error('[BrowserPool] Page not responsive, reinitializing:', error);
      await this.close();
      await this.initialize();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
      this.page = undefined;
      this.initialized = false;
      console.log('[BrowserPool] Browser closed');
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export default BrowserPool.getInstance();
