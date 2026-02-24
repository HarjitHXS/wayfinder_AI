export interface QueueItem<T> {
  id: string;
  data: T;
  timestamp: number;
}

export type QueueProcessor<T> = (item: QueueItem<T>) => Promise<void>;

export class TaskQueue<T> {
  private queue: QueueItem<T>[] = [];
  private processing = false;
  private onProcess: QueueProcessor<T>;

  constructor(processor: QueueProcessor<T>) {
    this.onProcess = processor;
  }

  enqueue(id: string, data: T): void {
    this.queue.push({
      id,
      data,
      timestamp: Date.now(),
    });
    this.process();
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        try {
          await this.onProcess(item);
        } catch (error) {
          console.error(`[Queue] Error processing ${item.id}:`, error);
        }
      }
    }
    this.processing = false;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  isProcessing(): boolean {
    return this.processing;
  }
}
