import { TaskExecution } from '../types/index';

interface SessionEntry {
  task: TaskExecution;
  createdAt: number;
  lastAccessed: number;
}

class SessionManager {
  private static instance: SessionManager;
  private sessions = new Map<string, SessionEntry>();
  private cleanup?: NodeJS.Timeout;
  private readonly TTL = 30 * 60 * 1000; // 30 minutes
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

  private constructor() {
    this.startCleanupTimer();
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  createSession(id: string, task: TaskExecution): void {
    this.sessions.set(id, {
      task,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    });
    console.log(`[SessionManager] Created session ${id}. Total sessions: ${this.sessions.size}`);
  }

  getSession(id: string): TaskExecution | undefined {
    const entry = this.sessions.get(id);
    if (entry) {
      entry.lastAccessed = Date.now();
      return entry.task;
    }
    return undefined;
  }

  updateSession(id: string, task: TaskExecution): void {
    const entry = this.sessions.get(id);
    if (entry) {
      entry.task = task;
      entry.lastAccessed = Date.now();
    }
  }

  deleteSession(id: string): void {
    this.sessions.delete(id);
    console.log(`[SessionManager] Deleted session ${id}. Remaining: ${this.sessions.size}`);
  }

  private startCleanupTimer(): void {
    this.cleanup = setInterval(() => {
      const now = Date.now();
      let deleted = 0;

      for (const [id, entry] of this.sessions.entries()) {
        if (now - entry.lastAccessed > this.TTL) {
          this.sessions.delete(id);
          deleted++;
        }
      }

      if (deleted > 0) {
        console.log(`[SessionManager] Cleaned up ${deleted} expired sessions. Remaining: ${this.sessions.size}`);
      }
    }, this.CHECK_INTERVAL);
  }

  destroy(): void {
    if (this.cleanup) {
      clearInterval(this.cleanup);
    }
    this.sessions.clear();
  }

  getStats(): { totalSessions: number; oldestSession: number | null } {
    let oldestSession: number | null = null;
    for (const entry of this.sessions.values()) {
      if (!oldestSession || entry.createdAt < oldestSession) {
        oldestSession = Date.now() - entry.createdAt;
      }
    }
    return {
      totalSessions: this.sessions.size,
      oldestSession,
    };
  }
}

export default SessionManager.getInstance();
