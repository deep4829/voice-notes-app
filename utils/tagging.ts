/**
 * Automatic Contextual Tagging Module
 * Analyzes transcribed text to extract keywords, entities, dates, and common topics
 */

// Common business and topic keywords
const COMMON_TOPICS = {
  marketing: ["marketing", "campaign", "brand", "promotion", "seo", "content", "audience"],
  finance: ["budget", "cost", "expense", "revenue", "financial", "money", "payment", "invoice"],
  meeting: ["meeting", "discuss", "decision", "agenda", "action item", "follow-up"],
  project: ["project", "deadline", "task", "milestone", "deliverable", "scope"],
  client: ["client", "customer", "customer", "relationship", "feedback", "requirement"],
  technology: ["tech", "software", "development", "api", "database", "server", "cloud"],
  sales: ["sale", "deal", "lead", "pipeline", "opportunity", "close", "quota"],
  hr: ["hiring", "recruitment", "performance", "employee", "team", "culture"],
};

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
  "from", "is", "am", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "will", "would", "should", "could", "may", "might", "can", "must",
  "it", "this", "that", "these", "those", "i", "you", "he", "she", "we", "they",
]);

/**
 * Extract dates from text using regex patterns
 */
const extractDates = (text: string): string[] => {
  const dates: string[] = [];
  
  // Match common date patterns (MM/DD/YYYY, DD-MM-YYYY, YYYY-MM-DD, Month DD, etc.)
  const datePatterns = [
    /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/g,
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:st|nd|rd|th)?\b/gi,
    /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi,
  ];

  datePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      dates.push(...matches);
    }
  });

  return [...new Set(dates)].slice(0, 5); // Return unique dates, max 5
};

/**
 * Extract proper nouns (capitalized words that are not stop words)
 */
const extractProperNouns = (text: string): string[] => {
  const nouns: string[] = [];
  const words = text.split(/\s+/);

  words.forEach(word => {
    const cleanWord = word.replace(/[^\w]/g, '').toLowerCase();
    const originalWord = word.replace(/[^\w]/g, '');
    
    if (
      originalWord.length > 2 &&
      originalWord[0] === originalWord[0].toUpperCase() &&
      !STOP_WORDS.has(cleanWord)
    ) {
      nouns.push(originalWord);
    }
  });

  return [...new Set(nouns)].slice(0, 5); // Return unique nouns, max 5
};

/**
 * Extract topic tags based on keyword matching
 */
const extractTopics = (text: string): string[] => {
  const topics: string[] = [];
  const textLower = text.toLowerCase();

  Object.entries(COMMON_TOPICS).forEach(([topic, keywords]) => {
    const hasKeyword = keywords.some(keyword =>
      new RegExp(`\\b${keyword}\\b`).test(textLower)
    );
    
    if (hasKeyword) {
      topics.push(topic);
    }
  });

  return topics;
};

/**
 * Extract named entities (organizations, people, locations)
 * Simple heuristic: consecutive capitalized words
 */
const extractEntities = (text: string): string[] => {
  const entities: string[] = [];
  const words = text.split(/\s+/);
  let currentEntity: string[] = [];

  words.forEach(word => {
    const cleanWord = word.replace(/[^\w]/g, '');
    if (cleanWord && cleanWord[0] === cleanWord[0].toUpperCase()) {
      currentEntity.push(cleanWord);
    } else {
      if (currentEntity.length > 1) {
        const entity = currentEntity.join(" ");
        if (entity.length > 3) {
          entities.push(entity);
        }
      }
      currentEntity = [];
    }
  });

  return [...new Set(entities)].slice(0, 3); // Return unique entities, max 3
};

/**
 * Main function: Analyze transcription and extract all tags
 */
export const generateTags = (transcription: string): string[] => {
  if (!transcription || transcription.length === 0) {
    return [];
  }

  const allTags: string[] = [];

  // Extract different types of tags
  const dates = extractDates(transcription);
  const properNouns = extractProperNouns(transcription);
  const topics = extractTopics(transcription);
  const entities = extractEntities(transcription);

  // Combine all tags and remove duplicates
  const combined = [
    ...topics, // Topics get priority
    ...entities,
    ...properNouns,
    ...dates,
  ];

  const uniqueTags = [...new Set(combined)];

  // Limit to 10 tags
  return uniqueTags.slice(0, 10);
};

/**
 * Format tags for display (capitalize and format nicely)
 */
export const formatTag = (tag: string): string => {
  return tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
};

/**
 * Filter notes by tag
 */
export const filterByTag = (notes: any[], tag: string): any[] => {
  return notes.filter(note =>
    note.tags && note.tags.some(t => t.toLowerCase() === tag.toLowerCase())
  );
};

/**
 * Get all unique tags from a list of notes
 */
export const getAllTags = (notes: any[]): string[] => {
  const allTags = new Set<string>();
  
  notes.forEach(note => {
    if (note.tags) {
      note.tags.forEach((tag: string) => {
        allTags.add(tag.toLowerCase());
      });
    }
  });

  return Array.from(allTags);
};
