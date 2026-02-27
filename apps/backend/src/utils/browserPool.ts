import { chromium, Browser, Page } from 'playwright';

const MAX_INIT_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

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

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_INIT_RETRIES; attempt++) {
      try {
        console.log(`[BrowserPool] Initializing shared browser (attempt ${attempt}/${MAX_INIT_RETRIES})...`);

        this.browser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',                    // Safe for containers (no fork)
            '--disable-software-rasterizer',  // No software rendering needed
            '--disable-extensions',
            '--disable-blink-features=AutomationControlled',
            '--disable-background-networking',
          ],
        });

        const context = await this.browser.newContext({
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          viewport: { width: 1280, height: 720 },
        });

        this.page = await context.newPage();

        // Remove the webdriver flag that marks automated browsers
        await this.page.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });
        this.initialized = true;
        console.log('[BrowserPool] ✅ Browser initialized');
        return; // Success — exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[BrowserPool] Attempt ${attempt} failed:`, lastError.message);

        // Clean up partial state before retrying
        await this.close().catch(() => {});

        if (attempt < MAX_INIT_RETRIES) {
          console.log(`[BrowserPool] Retrying in ${RETRY_DELAY_MS}ms...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    console.error('[BrowserPool] ❌ All initialization attempts failed');
    throw lastError;
  }

  async getPage(): Promise<Page> {
    if (!this.browser || !this.page || !this.browser.isConnected() || this.page.isClosed()) {
      console.log('[BrowserPool] Browser disconnected or page closed, reinitializing...');
      await this.close();
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
