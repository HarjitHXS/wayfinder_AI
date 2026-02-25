import { Injectable } from '@angular/core';
import { Auth, authState, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signOut, User, getIdToken } from '@angular/fire/auth';
import { Observable, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

export interface UserProfile {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  isAuthenticated: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseAuthService {
  public user$: Observable<User | null>;
  public userProfile$: BehaviorSubject<UserProfile | null> = new BehaviorSubject<UserProfile | null>(null);

  constructor(private auth: Auth) {
    this.user$ = authState(this.auth);
    
    // Subscribe to user changes
    this.user$.subscribe(user => {
      if (user) {
        this.userProfile$.next({
          uid: user.uid,
          email: user.email || undefined,
          displayName: user.displayName || undefined,
          photoURL: user.photoURL || undefined,
          isAuthenticated: true,
        });
      } else {
        this.userProfile$.next(null);
      }
    });
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(this.auth, provider);
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(this.auth, email, password);
    } catch (error) {
      console.error('Email sign-in error:', error);
      throw error;
    }
  }

  /**
   * Sign up with email and password
   */
  async signUpWithEmail(email: string, password: string, displayName?: string): Promise<void> {
    try {
      const result = await createUserWithEmailAndPassword(this.auth, email, password);
      
      // Update display name if provided
      if (displayName) {
        // This would require additional backend call or Firebase SDK method
        console.log('Display name set on backend during signup');
      }
    } catch (error) {
      console.error('Email sign-up error:', error);
      throw error;
    }
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
      this.userProfile$.next(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  /**
   * Get the current user's ID token
   */
  async getIdToken(): Promise<string | null> {
    const user = this.auth.currentUser;
    if (!user) return null;
    try {
      return await getIdToken(user);
    } catch (error) {
      console.error('Error getting ID token:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): Observable<boolean> {
    return this.user$.pipe(
      map(user => !!user)
    );
  }

  /**
   * Get current user (synchronous, may be null)
   */
  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }
}
