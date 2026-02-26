import { TaskExecution } from '../types/index';

interface SessionEntry {
  task: TaskExecution;
  createdAt: number;
  lastAccessed: number;
  ownerUid?: string;
}

class SessionManager {
  private static instance: SessionManager;
  private sessions = new Map<string, SessionEntry>();
  private cleanup?: NodeJS.Timeout;
  private readonly TTL = 30 * 60 * 1000; // 30 minutes
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes
  private readonly MAX_SESSIONS_PER_USER = 10; // Limit concurrent sessions per user
  private readonly MAX_TOTAL_SESSIONS = 1000; // Global limit to prevent memory exhaustion

  private constructor() {
    this.startCleanupTimer();
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  createSession(id: string, task: TaskExecution, ownerUid?: string): void {
    // Security: Prevent session ID injection attacks
    const sanitizedId = id.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 64);
    
    // Security: Check global session limit
    if (this.sessions.size >= this.MAX_TOTAL_SESSIONS) {
      console.warn('[SessionManager] Maximum total sessions reached, cleaning up oldest');
      this.cleanupOldestSessions(100); // Remove 100 oldest sessions
    }
    
    // Security: Limit sessions per user
    if (ownerUid) {
      const userSessions = this.getUserSessionCount(ownerUid);
      if (userSessions >= this.MAX_SESSIONS_PER_USER) {
        console.warn(`[SessionManager] User ${ownerUid} has reached max sessions, cleaning up oldest`);
        this.cleanupUserSessions(ownerUid, 1);
      }
    }
    
    this.sessions.set(sanitizedId, {
      task,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      ownerUid,
    });
    console.log(`[SessionManager] Created session ${sanitizedId}. Total sessions: ${this.sessions.size}`);
  }

  getSession(id: string): TaskExecution | undefined {
    const entry = this.sessions.get(id);
    if (entry) {
      entry.lastAccessed = Date.now();
      return entry.task;
    }
    return undefined;
  }

  getSessionEntry(id: string): SessionEntry | undefined {
    const entry = this.sessions.get(id);
    if (entry) {
      entry.lastAccessed = Date.now();
    }
    return entry;
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

  private getUserSessionCount(uid: string): number {
    let count = 0;
    for (const entry of this.sessions.values()) {
      if (entry.ownerUid === uid) {
        count++;
      }
    }
    return count;
  }

  private cleanupUserSessions(uid: string, countToRemove: number): void {
    const userSessions: [string, SessionEntry][] = [];
    for (const [id, entry] of this.sessions.entries()) {
      if (entry.ownerUid === uid) {
        userSessions.push([id, entry]);
      }
    }
    
    // Sort by last accessed, oldest first
    userSessions.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    // Remove oldest
    for (let i = 0; i < Math.min(countToRemove, userSessions.length); i++) {
      this.sessions.delete(userSessions[i][0]);
    }
  }

  private cleanupOldestSessions(count: number): void {
    const allSessions = Array.from(this.sessions.entries());
    allSessions.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    for (let i = 0; i < Math.min(count, allSessions.length); i++) {
      this.sessions.delete(allSessions[i][0]);
    }
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
