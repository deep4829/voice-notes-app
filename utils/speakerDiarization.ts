import * as FileSystem from 'expo-file-system/legacy';
import { SpeakerSegment } from '@/types/note';

const ASSEMBLY_UPLOAD_URL = 'https://api.assemblyai.com/v2/upload';
const ASSEMBLY_TRANSCRIPT_URL = 'https://api.assemblyai.com/v2/transcript';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface AssemblyWord {
  confidence?: number;
}

interface AssemblyUtterance {
  speaker?: number | string;
  start?: number;
  end?: number;
  text?: string;
  words?: AssemblyWord[];
}

interface AssemblyTranscriptResponse {
  id?: string;
  status?: string;
  utterances?: AssemblyUtterance[];
  text?: string;
  error?: string;
  speaker_labels?: Array<{ speaker: string | number }>;
}

export interface SpeakerDiarizationResult {
  segments: SpeakerSegment[];
  speakerCount: number;
  transcript: string;
}

const parseSpeakerId = (value: number | string | undefined): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Handle "A", "B", "C" format → 0, 1, 2
    if (value.length === 1 && /^[A-Z]$/.test(value)) {
      return value.charCodeAt(0) - 65;
    }
    // Handle "SPEAKER A", "SPEAKER B" format
    const letterMatch = value.match(/[A-Z]$/);
    if (letterMatch) {
      return letterMatch[0].charCodeAt(0) - 65;
    }
    // Handle numeric strings like "0", "1", "2"
    const numMatch = value.match(/(\d+)/);
    if (numMatch) return parseInt(numMatch[1], 10);
  }
  return 0; // default to speaker 0, not modulo fallback
};

const averageConfidence = (words?: AssemblyWord[]): number | undefined => {
  if (!words || words.length === 0) return undefined;
  const total = words.reduce((sum, word) => sum + (word.confidence ?? 0), 0);
  return total / words.length;
};

export const diarizeWithAssemblyAI = async (
  audioUri: string,
  apiKey: string
): Promise<SpeakerDiarizationResult> => {
  if (!apiKey) {
    throw new Error('Missing AssemblyAI API key');
  }

  const uploadResponse = await FileSystem.uploadAsync(ASSEMBLY_UPLOAD_URL, audioUri, {
    httpMethod: 'POST',
    headers: { authorization: apiKey },
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });

  const uploadJson = JSON.parse(uploadResponse.body || '{}');
  const uploadUrl = uploadJson.upload_url;
  if (!uploadUrl) {
    throw new Error('AssemblyAI upload failed');
  }

  const transcriptStart = await fetch(ASSEMBLY_TRANSCRIPT_URL, {
    method: 'POST',
    headers: {
      authorization: apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: uploadUrl,
      speaker_labels: true,
      punctuate: true,
      format_text: true,
    }),
  });

  const transcriptInfo: AssemblyTranscriptResponse = await transcriptStart.json();
  const transcriptId = transcriptInfo.id;
  if (!transcriptId) {
    throw new Error('AssemblyAI failed to start diarization');
  }

  let status = transcriptInfo.status;
  let pollData: AssemblyTranscriptResponse = transcriptInfo;
  const startTime = Date.now();

  while (status === 'queued' || status === 'processing') {
    if (Date.now() - startTime > 7 * 60 * 1000) {
      throw new Error('AssemblyAI diarization timed out');
    }
    await sleep(2000);
    const pollRes = await fetch(`${ASSEMBLY_TRANSCRIPT_URL}/${transcriptId}`, {
      headers: { authorization: apiKey },
    });
    pollData = await pollRes.json();
    status = pollData.status;
  }

  if (status !== 'completed') {
    throw new Error(pollData.error || 'AssemblyAI diarization failed');
  }

  const segments: SpeakerSegment[] = (pollData.utterances || []).map((utterance) => ({
    speaker: parseSpeakerId(utterance.speaker),
    startTime: utterance.start ?? 0,
    endTime: utterance.end ?? utterance.start ?? 0,
    text: utterance.text || '',
    confidence: averageConfidence(utterance.words),
  }));

  const speakerCount = pollData.speaker_labels?.length
    ? pollData.speaker_labels.length
    : new Set(segments.map(seg => seg.speaker)).size;

  return {
    segments,
    speakerCount,
    transcript: pollData.text || '',
  };
};
