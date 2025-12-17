/**
 * Unified Transcription Service
 * Provides speaker diarization using AssemblyAI or Deepgram
 * Falls back to Rork for basic transcription if needed
 */

import { TRANSCRIPTION_PROVIDER } from './transcriptionConfig';
import type { TranscriptionResult } from './transcriptionConfig';

interface SpeakerSegment {
  speaker: number;
  text: string;
  start: number;
  end: number;
  confidence: number;
}

/**
 * Transcribe audio with optional speaker diarization
 * Uses configured provider: AssemblyAI > Deepgram > Rork
 */
export async function transcribeAudio(audioUri: string): Promise<TranscriptionResult> {
  try {
    if (TRANSCRIPTION_PROVIDER === 'assemblyai') {
      return await transcribeWithAssemblyAI(audioUri);
    } else if (TRANSCRIPTION_PROVIDER === 'deepgram') {
      return await transcribeWithDeepgram(audioUri);
    } else {
      // Default to Rork
      return await transcribeWithRork(audioUri);
    }
  } catch (error) {
    console.error('[Transcription] Service failed:', error);
    // Fallback to Rork if provider fails
    if (TRANSCRIPTION_PROVIDER !== 'rork') {
      console.log('[Transcription] Falling back to Rork...');
      return await transcribeWithRork(audioUri);
    }
    throw error;
  }
}

/**
 * Transcribe with AssemblyAI (speaker diarization enabled)
 */
async function transcribeWithAssemblyAI(audioUri: string): Promise<TranscriptionResult> {
  try {
    const { transcribeWithDiarization } = await import('./assemblyAIAPI');
    
    const result = await transcribeWithDiarization(audioUri);
    
    return {
      text: result.fullText,
      language: 'auto',
      speakerSegments: result.speakers,
      speakerCount: result.speakerCount,
      formattedTranscript: formatSpeakerTranscript(result.speakers),
    };
  } catch (error) {
    console.error('[AssemblyAI] Transcription failed:', error);
    throw error;
  }
}

/**
 * Transcribe with Deepgram (speaker diarization enabled)
 */
async function transcribeWithDeepgram(audioUri: string): Promise<TranscriptionResult> {
  try {
    const { transcribeWithDiarization } = await import('./deepgramAPI');
    
    const result = await transcribeWithDiarization(audioUri);
    
    return {
      text: result.fullText,
      language: 'auto',
      speakerSegments: result.speakers,
      speakerCount: result.speakerCount,
      formattedTranscript: formatSpeakerTranscript(result.speakers),
    };
  } catch (error) {
    console.error('[Deepgram] Transcription failed:', error);
    throw error;
  }
}

/**
 * Transcribe with Rork (basic, no speaker diarization)
 */
async function transcribeWithRork(audioUri: string): Promise<TranscriptionResult> {
  try {
    const formData = new FormData();
    
    // Fetch audio file and append to form data
    const response = await fetch(audioUri);
    const blob = await response.blob();
    
    formData.append('audio_file', blob, 'recording.wav');
    
    const transcriptionResponse = await fetch(
      'https://toolkit.rork.com/stt/transcribe/',
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!transcriptionResponse.ok) {
      throw new Error('Rork transcription failed');
    }

    const result = await transcriptionResponse.json();
    
    return {
      text: result.text || '',
      language: result.language || 'en',
      speakerSegments: undefined,
      speakerCount: undefined,
      formattedTranscript: result.text,
    };
  } catch (error) {
    console.error('[Rork] Transcription failed:', error);
    throw error;
  }
}

/**
 * Format speaker segments for display
 * e.g., "Speaker 1: Hello, how are you? Speaker 2: I'm fine, thank you."
 */
export function formatSpeakerTranscript(speakers: SpeakerSegment[]): string {
  return speakers
    .map((seg) => `Speaker ${seg.speaker + 1}: ${seg.text}`)
    .join(' ');
}

/**
 * Format speaker segments with line breaks for multiline display
 */
export function formatSpeakerTranscriptMultiline(speakers: SpeakerSegment[]): string {
  return speakers
    .map((seg) => `Speaker ${seg.speaker + 1}: ${seg.text}`)
    .join('\n\n');
}

/**
 * Get list of unique speakers
 */
export function getSpeakers(segments: SpeakerSegment[] | undefined): number[] {
  if (!segments) return [];
  const speakers = new Set(segments.map((s) => s.speaker));
  return Array.from(speakers).sort((a, b) => a - b);
}
