/*
  Gemini helper
  - Expects two env vars in the Expo app config:
    - EXPO_PUBLIC_GEMINI_API_URL  (full endpoint URL for your Gemini deployment)
    - EXPO_PUBLIC_GEMINI_API_KEY  (Bearer key)

  The endpoint contract is intentionally flexible: it sends JSON {prompt, max_tokens, model}
  and expects a JSON {text: "..."} or {choices:[{text:'...'}]} response. If the exact
  Gemini REST API you use differs, adapt the request/response parsing here.

  This module returns a single-string summary with N lines separated by newlines.
*/

export const summarizeWithGemini = async (
  text: string,
  lines: number = 3,
  language: string = 'en'
): Promise<string> => {
  // Support two modes:
  // 1) If EXPO_PUBLIC_GEMINI_API_URL is set, use it as-is.
  // 2) Otherwise construct the Google GenAI REST endpoint using EXPO_PUBLIC_GEMINI_MODEL
  const configuredUrl = process.env.EXPO_PUBLIC_GEMINI_API_URL || '';
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
  const model = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash';

  // Build default Google endpoint if none provided
  const url = configuredUrl || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  if (!url || !apiKey) {
    throw new Error('Gemini API URL or API key missing; set EXPO_PUBLIC_GEMINI_API_URL and EXPO_PUBLIC_GEMINI_API_KEY, or set EXPO_PUBLIC_GEMINI_MODEL and EXPO_PUBLIC_GEMINI_API_KEY for Google GenAI.');
  }

  const prompt = `You are a concise summarization assistant. Produce exactly ${lines} short sentences as a summary (one sentence per line) in the same language as the input. Use plain text only and do not add any preamble.\n\nInput Transcript:\n${text}`;

  try {
    const body = {
      prompt,
      max_tokens: 256,
      temperature: 0.2,
      model: 'gemini',
    };

    // Simple retry loop for 5xx errors
    const maxRetries = 2;
    let attempt = 0;
    let res: Response | null = null;
    let lastBodyText: string | null = null;

    while (attempt <= maxRetries) {
      attempt++;

      // Use Google Key header if using Google GenAI default endpoint or when configured
      const isGoogleEndpoint = url.includes('generativelanguage.googleapis.com');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (isGoogleEndpoint) {
        headers['x-goog-api-key'] = apiKey;
      } else {
        // Allow bearer-style keys for custom endpoints
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      // Always read body text once and store it to avoid double-reading
      try {
        lastBodyText = await res.text();
      } catch (e) {
        lastBodyText = null;
      }

      if (res.ok) break;

      // 4xx errors -> don't retry
      if (res.status >= 400 && res.status < 500) break;

      // Otherwise 5xx -> retry after a brief backoff
      if (attempt <= maxRetries) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }

    if (!res) {
      throw new Error('No response from Gemini API');
    }

    if (!res.ok) {
      const text = lastBodyText ?? '';
      if (res.status === 404) {
        throw new Error('Gemini endpoint not found (404). Check EXPO_PUBLIC_GEMINI_API_URL.');
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error('Gemini API authorization failed (check EXPO_PUBLIC_GEMINI_API_KEY).');
      }
      throw new Error(`Gemini API request failed: ${res.status} ${text}`);
    }

    // We have a successful response; parse JSON from the stored body text if available
    let data: any;
    if (lastBodyText) {
      try {
        data = JSON.parse(lastBodyText);
      } catch (e) {
        // If parsing fails, attempt res.json as a fallback (shouldn't happen because body already consumed)
        try {
          data = await res.json();
        } catch (e2) {
          data = { text: lastBodyText };
        }
      }
    } else {
      // If we couldn't read as text earlier, try res.json (may throw 'Already read' if consumed)
      data = await res.json();
    }

    // shape1: {text: '...'}
    if (data && typeof data.text === 'string') {
      return data.text.trim();
    }

    // shape2: {choices: [{text: '...'}]}
    if (Array.isArray(data.choices) && data.choices[0] && typeof data.choices[0].text === 'string') {
      return data.choices[0].text.trim();
    }

    // shape3: {output: [{content: '...'}]} (some vendors)
    if (Array.isArray(data.output) && data.output[0] && typeof data.output[0].content === 'string') {
      return data.output[0].content.trim();
    }

    // Fallback: if data is a string-like, return it
    if (typeof data === 'string') return data.trim();

    // Fallback: stringify
    return String(data).trim();
  } catch (error: any) {
    console.error('[Gemini] Summarization failed:', error?.message || error);
    // Wrap error to provide more context to the caller
    throw new Error(error?.message || 'Gemini summarization error');
  }
};
