/**
 * Deepgram API Integration
 * Provides speaker diarization transcription using Deepgram's free tier
 * 
 * Setup:
 * 1. Sign up at https://console.deepgram.com (no CC required)
 * 2. Create API key in console settings
 * 3. Add to .env.local: EXPO_PUBLIC_DEEPGRAM_API_KEY=your_key
 * 4. API key is automatically loaded from environment
 */

import Constants from 'expo-constants';

export interface SpeakerSegment {
  speaker: number;
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface DiarizedTranscript {
  fullText: string;
  speakers: SpeakerSegment[];
  speakerCount: number;
  confidence: number;
}

/**
 * Get Deepgram API key from environment
 */
export function getDeepgramApiKey(): string | null {
  try {
    const key = Constants.expoConfig?.extra?.deepgramApiKey;
    if (key) return key;
    // For web/Node.js environments
    if (typeof window === 'undefined' && typeof process !== 'undefined') {
      return (process.env as any).EXPO_PUBLIC_DEEPGRAM_API_KEY || null;
    }
    return null;
  } catch (error) {
    console.warn('[Deepgram] Failed to load API key from environment');
    return null;
  }
}

/**
 * Transcribe audio with speaker diarization using Deepgram
 * Automatically uses API key from environment variables
 */
export async function transcribeWithDiarization(
  audioUri: string,
  apiKey?: string
): Promise<DiarizedTranscript> {
  const key = apiKey || getDeepgramApiKey();
  try {
    if (!key) {
      throw new Error('Deepgram API key not found. Add EXPO_PUBLIC_DEEPGRAM_API_KEY to .env.local');
    }

    // Fetch audio file
    const response = await fetch(audioUri);
    const audioBlob = await response.blob();

    // Call Deepgram API with speaker diarization enabled
    const deepgramResponse = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-2&diarize=true&punctuate=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${key}`,
          'Content-Type': audioBlob.type || 'audio/wav',
        },
        body: audioBlob,
      }
    );

    if (!deepgramResponse.ok) {
      const error = await deepgramResponse.json();
      throw new Error(`Deepgram API error: ${error.err_msg || deepgramResponse.statusText}`);
    }

    const result = await deepgramResponse.json();

    // Parse Deepgram response and extract speaker segments
    const segments = parseDiarizationResponse(result);

    return {
      fullText: result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '',
      speakers: segments,
      speakerCount: Math.max(...segments.map(s => s.speaker), 0) + 1,
      confidence: result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0,
    };
  } catch (error) {
    console.error('[Deepgram] Diarization failed:', error);
    throw error;
  }
}

/**
 * Parse Deepgram response to extract speaker segments
 */
function parseDiarizationResponse(deepgramResult: any): SpeakerSegment[] {
  const segments: SpeakerSegment[] = [];

  try {
    const words = deepgramResult.results?.channels?.[0]?.alternatives?.[0]?.words || [];

    let currentSegment: SpeakerSegment | null = null;

    for (const word of words) {
      const speaker = word.speaker ?? 0;
      const text = word.punctuated_word || word.word;

      if (!currentSegment || currentSegment.speaker !== speaker) {
        // New speaker detected
        if (currentSegment) {
          segments.push(currentSegment);
        }

        currentSegment = {
          speaker,
          text: text + ' ',
          start: word.start || 0,
          end: word.end || 0,
          confidence: word.confidence || 0.9,
        };
      } else {
        // Continue with same speaker
        currentSegment.text += text + ' ';
        currentSegment.end = word.end || currentSegment.end;
        currentSegment.confidence = (currentSegment.confidence + (word.confidence || 0.9)) / 2;
      }
    }

    // Push final segment
    if (currentSegment) {
      segments.push(currentSegment);
    }
  } catch (error) {
    console.error('[Deepgram] Error parsing diarization response:', error);
  }

  return segments;
}

/**
 * Format speaker segments for display
 */
export function formatSpeakerTranscript(speakers: SpeakerSegment[]): string {
  return speakers
    .map((seg) => `Speaker ${seg.speaker + 1}: ${seg.text.trim()}`)
    .join('\n\n');
}

/**
 * Get speaker summary (names/labels for each speaker)
 */
export function getSpeakerSummary(speakerCount: number): string[] {
  return Array.from({ length: speakerCount }, (_, i) => `Speaker ${i + 1}`);
}
