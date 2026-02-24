// Voice Service for Wayfinder AI
// Add to: frontend/src/app/services/voice.service.ts

import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class VoiceService {
  private synth = window.speechSynthesis;
  private voice: SpeechSynthesisVoice | null = null;
  private recognition: any = null;
  private isListening = false;

  constructor() {
    // Initialize speech synthesis voice
    this.initializeSpeechSynthesis();
    
    // Initialize speech recognition
    this.initializeSpeechRecognition();
  }

  private initializeSpeechSynthesis() {
    // Wait for voices to load
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.loadVoice();
    }
    setTimeout(() => this.loadVoice(), 100);
  }

  private loadVoice() {
    const voices = this.synth.getVoices();
    // Try to find a pleasant female voice
    this.voice = voices.find(v => 
      v.name.includes('Samantha') || 
      v.name.includes('Karen') ||
      v.name.includes('Google') && v.name.includes('Female')
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    
    console.log('Voice loaded:', this.voice?.name);
  }

  private initializeSpeechRecognition() {
    const SpeechRecognition = (window as any).SpeechRecognition || 
                             (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
    } else {
      console.warn('Speech recognition not supported in this browser');
    }
  }

  /**
   * Make the agent speak a message
   * @param text - Text for the agent to speak
   * @param rate - Speech rate (0.1 to 10, default 1.1 for slightly faster)
   */
  speak(text: string, rate: number = 1.1): void {
    if (!this.synth) {
      console.warn('Speech synthesis not available');
      return;
    }
    
    // Cancel any ongoing speech
    this.synth.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;
    utterance.voice = this.voice;
    
    // Add event listeners for debugging
    utterance.onstart = () => console.log('🔊 Speaking:', text);
    utterance.onend = () => console.log('✅ Finished speaking');
    utterance.onerror = (e) => console.error('❌ Speech error:', e);
    
    this.synth.speak(utterance);
  }

  /**
   * Stop any ongoing speech
   */
  stopSpeaking(): void {
    this.synth?.cancel();
  }

  /**
   * Check if speech synthesis is available
   */
  isSpeechSynthesisAvailable(): boolean {
    return !!this.synth;
  }

  /**
   * Check if speech recognition is available
   */
  isSpeechRecognitionAvailable(): boolean {
    return !!this.recognition;
  }

  /**
   * Start listening for voice input
   * @param onResult - Callback for interim and final results
   * @param onEnd - Callback when recognition ends
   */
  startListening(
    onResult: (transcript: string, isFinal: boolean) => void,
    onEnd?: () => void
  ): void {
    if (!this.recognition) {
      console.error('Speech recognition not available');
      return;
    }

    if (this.isListening) {
      console.warn('Already listening');
      return;
    }

    this.recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        const isFinal = event.results[i].isFinal;
        onResult(transcript, isFinal);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      console.log('🎤 Stopped listening');
      if (onEnd) onEnd();
    };

    this.recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      this.isListening = false;
      if (onEnd) onEnd();
    };

    this.recognition.start();
    this.isListening = true;
    console.log('🎤 Started listening...');
  }

  /**
   * Stop listening for voice input
   */
  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  /**
   * Check if currently listening
   */
  getIsListening(): boolean {
    return this.isListening;
  }
}
