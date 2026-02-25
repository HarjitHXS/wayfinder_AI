import { Request, Response } from 'express';
import { SpeechClient } from '@google-cloud/speech';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';

const speechClient = new SpeechClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'wayfinder-ai'
});
const ttsClient = new TextToSpeechClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'wayfinder-ai'
});

interface TranscribeRequest {
  audioBase64: string;
  encoding?: string;
  sampleRateHertz?: number;
  languageCode?: string;
}

interface SynthesizeRequest {
  text: string;
  voiceName?: string;
  languageCode?: string;
  speakingRate?: number;
  pitch?: number;
  audioEncoding?: string;
}

export async function transcribeAudio(req: Request, res: Response) {
  try {
    const { audioBase64, encoding, sampleRateHertz, languageCode } = req.body as TranscribeRequest;

    if (!audioBase64) {
      return res.status(400).json({ error: 'audioBase64 is required' });
    }

    const request = {
      audio: { content: audioBase64 },
      config: {
        encoding: encoding || 'WEBM_OPUS',
        sampleRateHertz: sampleRateHertz || 48000,
        languageCode: languageCode || 'en-US',
        enableAutomaticPunctuation: true,
      },
    };

    const [response] = await speechClient.recognize(request as any);
    const transcript = response.results
      ?.map((result) => result.alternatives?.[0]?.transcript || '')
      .join(' ')
      .trim();

    res.json({ transcript: transcript || '' });
  } catch (error) {
    console.error('[voice] Transcription failed:', error);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
}

export async function synthesizeSpeech(req: Request, res: Response) {
  try {
    const { text, voiceName, languageCode, speakingRate, pitch, audioEncoding } = req.body as SynthesizeRequest;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const request = {
      input: { text },
      voice: {
        languageCode: languageCode || 'en-US',
        name: voiceName || undefined,
      },
      audioConfig: {
        audioEncoding: audioEncoding || 'MP3',
        speakingRate: speakingRate ?? 1.05,
        pitch: pitch ?? 0,
      },
    };

    const response = await ttsClient.synthesizeSpeech(request as any);
    const result = Array.isArray(response) ? response[0] : response;
    const audioContent = result?.audioContent
      ? Buffer.from(result.audioContent as Uint8Array).toString('base64')
      : '';

    res.json({
      audioBase64: audioContent,
      mimeType: 'audio/mpeg',
    });
  } catch (error) {
    console.error('[voice] Synthesis failed:', error);
    res.status(500).json({ error: 'Failed to synthesize speech' });
  }
}
