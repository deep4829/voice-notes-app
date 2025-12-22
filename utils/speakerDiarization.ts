import { SpeakerSegment } from '@/types/note';

const SPEECHMATICS_JOB_URL = 'https://asr.api.speechmatics.com/v2/jobs';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface SpeechmaticsWord {
  type?: string;
  start_time?: number;
  end_time?: number;
  alternatives?: Array<{ content?: string; confidence?: number; speaker?: string; language?: string }>;
}

interface SpeechmaticsJobData {
  id?: string;
  status?: string;
  created_at?: string;
  duration?: number;
  config?: any;
  error?: { reason?: string } | string;
}

interface SpeechmaticsJobResponse {
  job?: SpeechmaticsJobData;
  id?: string;
  status?: string;
}

interface SpeechmaticsTranscriptResponse {
  results?: SpeechmaticsWord[];
}

export interface SpeakerDiarizationResult {
  segments: SpeakerSegment[];
  speakerCount: number;
  transcript: string;
}

const groupWordsToSegments = (words: SpeechmaticsWord[]): SpeakerSegment[] => {
  console.log('[Diarization] Grouping words to segments. Total words:', words.length);
  console.log('[Diarization] Sample of first 10 words:', words.slice(0, 10).map(w => ({
    content: w.alternatives?.[0]?.content,
    speaker: w.alternatives?.[0]?.speaker,
    start_time: w.start_time,
    end_time: w.end_time,
  })));
  
  // Count how many words have speaker info
  const wordsWithSpeaker = words.filter(w => w.alternatives?.[0]?.speaker !== undefined).length;
  console.log(`[Diarization] Words with speaker info: ${wordsWithSpeaker}/${words.length}`);
  
  // Build speaker ID mapping to normalize speaker IDs (S1->1, S2->2, etc)
  const speakerIdMap = new Map<string, number>();
  let nextSpeakerId = 1;
  const uniqueSpeakers = new Set<string>();
  
  for (const word of words) {
    const rawSpeakerId = word.alternatives?.[0]?.speaker;
    if (rawSpeakerId) {
      uniqueSpeakers.add(rawSpeakerId);
      if (!speakerIdMap.has(rawSpeakerId)) {
        speakerIdMap.set(rawSpeakerId, nextSpeakerId);
        nextSpeakerId++;
      }
    }
  }
  console.log('[Diarization] Unique raw speakers found:', Array.from(uniqueSpeakers));
  console.log('[Diarization] Speaker ID mapping:', Array.from(speakerIdMap.entries()));
  
  const segments: SpeakerSegment[] = [];
  let currentSpeaker: number | undefined;
  let buffer: string[] = [];
  let segmentStart = 0;
  let segmentEnd = 0;
  let confidences: number[] = [];

  const flush = () => {
    if (currentSpeaker === undefined || buffer.length === 0) return;
    const avgConfidence = confidences.length
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : undefined;
    const segmentText = buffer.join(' ').trim();
    console.log(`[Diarization] Creating segment for Speaker ${currentSpeaker}: "${segmentText.substring(0, 50)}..."`);
    segments.push({
      speaker: currentSpeaker,
      startTime: segmentStart,
      endTime: segmentEnd,
      text: segmentText,
      confidence: avgConfidence,
    });
    buffer = [];
    confidences = [];
  };

  for (const word of words) {
    if (!word || word.type !== 'word') continue;

    const alt = word.alternatives?.[0];
    const wordText = alt?.content?.trim();
    if (!wordText) continue;

    // Speaker is inside alternatives, use mapped ID to normalize (S1->1, S2->2, etc)
    const rawSpeaker = alt?.speaker; // e.g., "S1", "S2"
    
    // Skip words without speaker info
    if (!rawSpeaker) {
      console.log('[Diarization] Skipping word without speaker info:', wordText);
      continue;
    }
    if (!speakerIdMap.has(rawSpeaker)) {
      console.log('[Diarization] Unknown speaker ID:', rawSpeaker, '- available:', Array.from(speakerIdMap.keys()));
      continue;
    }
    
    const speakerId = speakerIdMap.get(rawSpeaker)!;
    const startTime = Math.floor((word.start_time ?? 0) * 1000);
    const endTime = Math.floor((word.end_time ?? word.start_time ?? 0) * 1000);
    const conf = alt?.confidence ?? 0;

    if (currentSpeaker === undefined) {
      currentSpeaker = speakerId;
      segmentStart = startTime;
    }

    if (speakerId !== currentSpeaker) {
      segmentEnd = endTime;
      flush();
      currentSpeaker = speakerId;
      segmentStart = startTime;
    }

    buffer.push(wordText);
    confidences.push(conf);
    segmentEnd = endTime;
  }

  flush();
  return segments;
};

// Normalize language code to 2-letter ISO 639-1 code
const normalizeLanguageCode = (lang: string): string => {
  if (!lang) return 'en';
  // Extract first 2 characters and lowercase (e.g., "eng" -> "en", "es-ES" -> "es")
  const normalized = lang.split('-')[0].toLowerCase().slice(0, 2);
  return normalized || 'en';
};

export const diarizeWithSpeechmatics = async (
  audioUri: string,
  apiKey: string,
  language: string = 'en'
): Promise<SpeakerDiarizationResult> => {
  const normalizedLanguage = normalizeLanguageCode(language);
  console.log('[Diarization] Starting Speechmatics diarization');
  console.log('[Diarization] Original language:', language);
  console.log('[Diarization] Normalized language:', normalizedLanguage);
  
  if (!apiKey) {
    console.error('[Diarization] Speechmatics API key missing');
    throw new Error('Missing Speechmatics API key');
  }

  const formData = new FormData();
  const config = {
    type: 'transcription',
    transcription_config: {
      language: normalizedLanguage,
      diarization: 'speaker',
    },
  };
  console.log('[Diarization] Sending config to Speechmatics:', JSON.stringify(config, null, 2));
  formData.append('config', JSON.stringify(config));

  const fileExt = audioUri.split('.').pop() || 'm4a';
  formData.append('data_file', {
    uri: audioUri,
    name: `audio.${fileExt}`,
    type: `audio/${fileExt}`,
  } as any);

  console.log('[Diarization] Submitting job to Speechmatics...');
  const jobRes = await fetch(SPEECHMATICS_JOB_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!jobRes.ok) {
    const text = await jobRes.text();
    console.error('[Diarization] Job submit failed:', jobRes.status, text);
    throw new Error(`Speechmatics job submit failed: ${jobRes.status} ${text}`);
  }

  const creationResponse: SpeechmaticsJobResponse = await jobRes.json();
  const jobId = creationResponse.id;
  console.log('[Diarization] Job created with ID:', jobId);
  
  if (!jobId) {
    console.error('[Diarization] Job ID missing from response');
    throw new Error('Speechmatics job id missing');
  }

  const startedAt = Date.now();
  let status: string | undefined;
  let pollCount = 0;
  console.log('[Diarization] Starting to poll for job completion...');

  // Keep polling until job is done or failed
  while (status !== 'done' && status !== 'failed') {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      console.error('[Diarization] Polling timeout after', pollCount, 'attempts');
      throw new Error('Speechmatics diarization timed out (10 minutes)');
    }
    
    await sleep(POLL_INTERVAL_MS);
    pollCount++;
    console.log(`[Diarization] Poll attempt ${pollCount} at ${Date.now() - startedAt}ms...`);
    
    // Only log full job details on first poll or when done
    if (pollCount === 1 || pollCount % 5 === 0) {
      console.log('[Diarization] Checking job config...');
    }
    
    const pollRes = await fetch(`${SPEECHMATICS_JOB_URL}/${jobId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!pollRes.ok) {
      const text = await pollRes.text();
      console.error('[Diarization] Job poll failed:', pollRes.status, text);
      throw new Error(`Speechmatics job poll failed: ${pollRes.status} ${text}`);
    }

    const pollResponse: SpeechmaticsJobResponse = await pollRes.json();
    // Status is nested under job.status
    status = pollResponse.job?.status;
    console.log(`[Diarization] Poll ${pollCount}: status = ${status}`);
    
    // Log job config on first successful poll
    if (pollCount === 1) {
      console.log('[Diarization] Job config from server:', JSON.stringify(pollResponse.job?.config || {}, null, 2));
      const jobConfig = pollResponse.job?.config;
      if (jobConfig) {
        console.log('[Diarization] Diarization enabled:', (jobConfig as any).transcription_config?.diarization);
        console.log('[Diarization] Full job config keys:', Object.keys(jobConfig));
      }
    }

    if (status === 'failed') {
      const error = pollResponse.job?.error;
      const reason = typeof error === 'string' ? error : error?.reason;
      console.error('[Diarization] Job failed:', reason);
      throw new Error(reason || 'Speechmatics job failed');
    }
  }

  console.log('[Diarization] Job completed! Waited', Date.now() - startedAt, 'ms over', pollCount, 'polls');
  
  // Wait a bit more to ensure transcript is ready
  await sleep(1000);
  
  // Try fetching with srt format first to see speaker information
  console.log('[Diarization] Fetching transcript in srt format to check speaker data...');
  const transcriptUrlSrt = `${SPEECHMATICS_JOB_URL}/${jobId}/transcript?format=srt`;
  console.log('[Diarization] Transcript SRT URL:', transcriptUrlSrt);
  
  let srtContent = '';
  try {
    const srtRes = await fetch(transcriptUrlSrt, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (srtRes.ok) {
      srtContent = await srtRes.text();
      console.log('[Diarization] SRT content (first 500 chars):', srtContent.substring(0, 500));
    }
  } catch (e) {
    console.log('[Diarization] SRT fetch error:', e);
  }
  
  console.log('[Diarization] Fetching transcript in json-v2 format...');
  const transcriptUrl = `${SPEECHMATICS_JOB_URL}/${jobId}/transcript?format=json-v2`;
  console.log('[Diarization] Transcript URL:', transcriptUrl);
  const transcriptRes = await fetch(transcriptUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!transcriptRes.ok) {
    const text = await transcriptRes.text();
    console.error('[Diarization] Transcript fetch failed:', transcriptRes.status, text);
    throw new Error(`Speechmatics transcript fetch failed: ${transcriptRes.status} ${text}`);
  }

  const transcriptJson: SpeechmaticsTranscriptResponse = await transcriptRes.json();
  console.log('[Diarization] Transcript received, parsing words...');
  console.log('[Diarization] Full transcript response:', JSON.stringify(transcriptJson, null, 2).substring(0, 2000));
  console.log('[Diarization] Transcript response keys:', Object.keys(transcriptJson));
  console.log('[Diarization] Results type:', typeof transcriptJson.results);
  console.log('[Diarization] Results is array:', Array.isArray(transcriptJson.results));

  const words = (transcriptJson.results || []).filter((r) => r.type === 'word');
  console.log('[Diarization] Found', words.length, 'words');
  console.log('[Diarization] First 5 words with speaker info:', words.slice(0, 5).map(w => ({
    content: w.alternatives?.[0]?.content,
    speaker: w.alternatives?.[0]?.speaker,
    confidence: w.alternatives?.[0]?.confidence,
    language: w.alternatives?.[0]?.language
  })));
  
  // Check if speaker data is present
  const wordsWithSpeaker = words.filter(w => w.alternatives?.[0]?.speaker).length;
  console.log(`[Diarization] IMPORTANT: ${wordsWithSpeaker}/${words.length} words have speaker data`);
  if (wordsWithSpeaker === 0) {
    console.warn('[Diarization] ⚠️ NO SPEAKER DATA DETECTED - Diarization may not be supported for language:', normalizedLanguage);
  }

  const segments = groupWordsToSegments(words);
  const speakerCount = new Set(segments.map((s) => s.speaker)).size;
  const transcript = words
    .map((w) => w.alternatives?.[0]?.content ?? '')
    .filter((t) => t.length > 0)
    .join(' ')
    .trim();

  // Detect overlapping conversations
  console.log('[Diarization] Checking for overlapping segments...');
  const overlaps: Array<{segment1: number, segment2: number, overlapStart: number, overlapEnd: number}> = [];
  
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const seg1 = segments[i];
      const seg2 = segments[j];
      
      const overlapStart = Math.max(seg1.startTime ?? 0, seg2.startTime ?? 0);
      const overlapEnd = Math.min(seg1.endTime ?? 0, seg2.endTime ?? 0);
      
      if (overlapStart < overlapEnd) {
        overlaps.push({
          segment1: i,
          segment2: j,
          overlapStart,
          overlapEnd
        });
        console.log(
          `[Diarization] OVERLAP: Segment ${i} (Speaker ${seg1.speaker}) and Segment ${j} (Speaker ${seg2.speaker}) ` +
          `overlap from ${overlapStart}ms to ${overlapEnd}ms`
        );
      }
    }
  }
  
  if (overlaps.length > 0) {
    console.log(`[Diarization] Found ${overlaps.length} overlapping speech sections`);
  } else {
    console.log('[Diarization] No overlapping segments detected - speakers take turns sequentially');
  }

  // Log segment timing details
  console.log('[Diarization] Segment timing details:');
  segments.forEach((seg, idx) => {
    console.log(
      `  Segment ${idx}: Speaker ${seg.speaker}, ${seg.startTime}ms - ${seg.endTime}ms (${seg.text.substring(0, 30)}...)`
    );
  });

  console.log(
    '[Diarization] Success! Found',
    speakerCount,
    'speakers,',
    segments.length,
    'segments,',
    transcript.length,
    'chars'
  );

  return {
    segments,
    speakerCount,
    transcript,
  };
};
