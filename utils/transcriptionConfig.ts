/**
 * Transcription Provider Configuration
 * Allows switching between multiple transcription services
 * Supported providers: 'rork', 'deepgram', 'assemblyai'
 */

export type TranscriptionProvider = 'rork' | 'deepgram' | 'assemblyai';

export interface TranscriptionResult {
  text: string;
  language?: string;
  speakerSegments?: Array<{
    speaker: number;
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  speakerCount?: number;
  formattedTranscript?: string;
}

/**
 * Configuration for the transcription service to use
 * Set this to choose which transcription provider to use
 */
export const TRANSCRIPTION_PROVIDER: TranscriptionProvider = 'rork';

/**
 * Use AssemblyAI for speaker-labeled transcription
 * Returns transcript with speaker identification
 */
export function useAssemblyAI(): boolean {
  return TRANSCRIPTION_PROVIDER === 'assemblyai';
}

/**
 * Use Deepgram for speaker-labeled transcription
 * Returns transcript with speaker identification
 */
export function useDeepgram(): boolean {
  return TRANSCRIPTION_PROVIDER === 'deepgram';
}

/**
 * Use Rork (default) for basic transcription
 * Returns plain text transcript
 */
export function useRork(): boolean {
  return TRANSCRIPTION_PROVIDER === 'rork';
}

/**
 * Get transcription provider description
 */
export function getProviderDescription(provider: TranscriptionProvider): string {
  const descriptions = {
    rork: 'Basic transcription via Rork',
    deepgram: 'Advanced transcription with speaker diarization (Deepgram)',
    assemblyai: 'Advanced transcription with speaker diarization (AssemblyAI)',
  };
  return descriptions[provider];
}
