import { Injectable } from '@angular/core';
import axios from 'axios';
import { getRuntimeApiUrl } from '../utils/api-url';

@Injectable({
  providedIn: 'root'
})
export class VoiceService {
  private apiUrl = getRuntimeApiUrl();
  private recorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private stream: MediaStream | null = null;
  private audioPlayer: HTMLAudioElement | null = null;
  private recording = false;

  isRecording(): boolean {
    return this.recording;
  }

  async startRecording(): Promise<void> {
    if (this.recording) return;

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = this.getSupportedMimeType();

    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];

    this.recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.recorder.start();
    this.recording = true;
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.recorder) {
        resolve(new Blob());
        return;
      }

      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.recorder?.mimeType || 'audio/webm' });
        this.cleanupStream();
        this.recording = false;
        resolve(blob);
      };

      this.recorder.stop();
    });
  }

  async transcribeAudio(blob: Blob): Promise<string> {
    const audioBase64 = await this.blobToBase64(blob);
    const response = await axios.post(`${this.apiUrl}/api/voice/transcribe`, {
      audioBase64,
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 48000,
      languageCode: 'en-US',
    });

    return response.data?.transcript || '';
  }

  async speak(text: string): Promise<void> {
    if (!text) return;

    const response = await axios.post(`${this.apiUrl}/api/voice/synthesize`, {
      text,
      languageCode: 'en-US',
      speakingRate: 1.05,
      pitch: 0,
      audioEncoding: 'MP3',
    });

    const audioBase64 = response.data?.audioBase64 || '';
    if (!audioBase64) return;

    const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
    this.stopSpeaking();
    this.audioPlayer = audio;
    await audio.play();
  }

  stopSpeaking(): void {
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.currentTime = 0;
      this.audioPlayer = null;
    }
  }

  private getSupportedMimeType(): string | null {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];

    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || null;
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private cleanupStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }
}
