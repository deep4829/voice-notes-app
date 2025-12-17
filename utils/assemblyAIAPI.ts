/**
 * AssemblyAI API Integration
 * Provides speaker diarization transcription using AssemblyAI
 * 
 * Setup:
 * 1. Sign up at https://www.assemblyai.com (free tier available)
 * 2. Create API key in dashboard
 * 3. Add to .env.local: EXPO_PUBLIC_ASSEMBLYAI_API_KEY=your_key
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
  utterances: any[];
}

/**
 * Get AssemblyAI API key from environment
 */
export function getAssemblyAIApiKey(): string | null {
  try {
    const key = Constants.expoConfig?.extra?.assemblyAIApiKey;
    if (key) return key;
    // For web/Node.js environments
    if (typeof window === 'undefined' && typeof process !== 'undefined') {
      return (process.env as any).EXPO_PUBLIC_ASSEMBLYAI_API_KEY || null;
    }
    return null;
  } catch (error) {
    console.warn('[AssemblyAI] Failed to load API key from environment');
    return null;
  }
}

/**
 * Upload audio file to AssemblyAI and get upload URL
 */
async function uploadAudioToAssemblyAI(audioUri: string, apiKey: string): Promise<string> {
  try {
    // Fetch the audio file
    const response = await fetch(audioUri);
    const audioBlob = await response.blob();

    // Upload to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v1/upload', {
      method: 'POST',
      headers: {
        Authorization: apiKey,
      },
      body: audioBlob,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }

    const uploadData = await uploadResponse.json();
    return uploadData.upload_url;
  } catch (error) {
    console.error('[AssemblyAI] Upload failed:', error);
    throw error;
  }
}

/**
 * Submit transcription request to AssemblyAI
 */
async function submitTranscriptionRequest(
  audioUrl: string,
  apiKey: string
): Promise<string> {
  try {
    const requestResponse = await fetch('https://api.assemblyai.com/v1/transcript', {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        speaker_labels: true, // Enable speaker diarization
        language_detection: false,
        punctuate: true,
      }),
    });

    if (!requestResponse.ok) {
      throw new Error(`Request submission failed: ${requestResponse.statusText}`);
    }

    const requestData = await requestResponse.json();
    return requestData.id; // transcript_id
  } catch (error) {
    console.error('[AssemblyAI] Request submission failed:', error);
    throw error;
  }
}

/**
 * Poll AssemblyAI for transcription status
 */
async function pollTranscriptionStatus(
  transcriptId: string,
  apiKey: string,
  maxAttempts: number = 120,
  delayMs: number = 2000
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const statusResponse = await fetch(
        `https://api.assemblyai.com/v1/transcript/${transcriptId}`,
        {
          headers: {
            Authorization: apiKey,
          },
        }
      );

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.statusText}`);
      }

      const result = await statusResponse.json();

      if (result.status === 'completed') {
        return result;
      } else if (result.status === 'error') {
        throw new Error(`Transcription error: ${result.error}`);
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (error) {
      console.error('[AssemblyAI] Status poll error:', error);
      throw error;
    }
  }

  throw new Error('Transcription polling timeout');
}

/**
 * Transcribe audio with speaker diarization using AssemblyAI
 */
export async function transcribeWithDiarization(
  audioUri: string,
  apiKey?: string
): Promise<DiarizedTranscript> {
  const key = apiKey || getAssemblyAIApiKey();
  try {
    if (!key) {
      throw new Error(
        'AssemblyAI API key not found. Add EXPO_PUBLIC_ASSEMBLYAI_API_KEY to environment'
      );
    }

    // Step 1: Upload audio file
    console.log('[AssemblyAI] Uploading audio...');
    const audioUrl = await uploadAudioToAssemblyAI(audioUri, key);

    // Step 2: Submit transcription request with speaker diarization
    console.log('[AssemblyAI] Submitting transcription request...');
    const transcriptId = await submitTranscriptionRequest(audioUrl, key);

    // Step 3: Poll for completion
    console.log('[AssemblyAI] Waiting for transcription to complete...');
    const result = await pollTranscriptionStatus(transcriptId, key);

    // Step 4: Parse response and extract speaker segments
    const segments = parseDiarizationResponse(result);

    return {
      fullText: result.text || '',
      speakers: segments,
      speakerCount: Math.max(...segments.map((s) => s.speaker), -1) + 1,
      confidence: 0.95, // AssemblyAI average confidence
      utterances: result.utterances || [],
    };
  } catch (error) {
    console.error('[AssemblyAI] Diarization failed:', error);
    throw error;
  }
}

/**
 * Parse AssemblyAI response to extract speaker segments from utterances
 */
function parseDiarizationResponse(assemblyAIResult: any): SpeakerSegment[] {
  const segments: SpeakerSegment[] = [];

  try {
    const utterances = assemblyAIResult.utterances || [];

    if (utterances.length === 0) {
      // If no speaker labels, treat as single speaker
      return [
        {
          speaker: 0,
          text: assemblyAIResult.text || '',
          start: 0,
          end: assemblyAIResult.audio_duration || 0,
          confidence: 0.95,
        },
      ];
    }

    // Process utterances - each utterance is a speaker turn
    for (const utterance of utterances) {
      segments.push({
        speaker: utterance.speaker,
        text: utterance.text,
        start: utterance.start / 1000, // Convert ms to seconds
        end: utterance.end / 1000,
        confidence: 0.95, // AssemblyAI provides confidence per word, we'll use default
      });
    }
  } catch (error) {
    console.error('[AssemblyAI] Error parsing diarization response:', error);
  }

  return segments;
}

/**
 * Format speaker segments for display
 */
export function formatSpeakerTranscript(speakers: SpeakerSegment[]): string {
  return speakers
    .map((seg) => `Speaker ${seg.speaker + 1}: ${seg.text}`)
    .join('\n\n');
}

/**
 * Get speaker summary (names/labels for each speaker)
 */
export function getSpeakerSummary(speakerCount: number): string[] {
  return Array.from({ length: speakerCount }, (_, i) => `Speaker ${i + 1}`);
}

/**
 * Format time in seconds to MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
