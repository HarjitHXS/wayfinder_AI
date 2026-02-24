import { Injectable } from '@angular/core';
import axios from 'axios';

export interface UserStats {
  totalUsers: number;
  totalLogins: number;
}

export interface FeedbackSummary {
  averageRating: number;
  totalRatings: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'http://localhost:3001';

  constructor() {
    this.apiUrl = (window as any).REACT_APP_API_URL || 'http://localhost:3001';
  }

  async login(username: string): Promise<void> {
    await axios.post(`${this.apiUrl}/api/users/login`, { username });
  }

  async getUserStats(): Promise<UserStats> {
    const response = await axios.get(`${this.apiUrl}/api/users/stats`);
    return response.data;
  }

  async submitFeedback(username: string, rating: number, comment: string): Promise<void> {
    await axios.post(`${this.apiUrl}/api/feedback`, { username, rating, comment });
  }

  async getFeedbackSummary(): Promise<FeedbackSummary> {
    const response = await axios.get(`${this.apiUrl}/api/feedback/summary`);
    return response.data;
  }
}
