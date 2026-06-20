export type CsvRow = Record<string, string>;

export type SentimentType = "positive" | "neutral" | "negative";
export type UrgencyType = "low" | "medium" | "high";

export interface AnalyzedFeedbackItem {
  id: string;
  feedbackText: string;
  date: string;
  source: string;
  segment: string;
  category: string;
  sentiment: SentimentType;
  urgency: UrgencyType;
  originalRow: CsvRow;
}

export interface CategoryStats {
  name: string;
  count: number;
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

export interface SentimentDistribution {
  positive: number;
  neutral: number;
  negative: number;
  positivePercentage: number;
  neutralPercentage: number;
  negativePercentage: number;
}

export interface KeywordStat {
  text: string;
  count: number;
}

export interface AnalysisResult {
  items: AnalyzedFeedbackItem[];
  totalCount: number;
  averageSentimentScore: number; // 0 to 100 based on positive vs negative
  sentimentDistribution: SentimentDistribution;
  categoryStats: CategoryStats[];
  topKeywords: KeywordStat[];
  urgentComplaints: AnalyzedFeedbackItem[];
}

export const CATEGORIES: string[] = []; // Kept as empty export for backwards compatibility

const STOP_WORDS = new Set([
  "the", "and", "a", "of", "to", "is", "in", "it", "that", "you", "for", "on", "with",
  "this", "my", "have", "are", "as", "at", "be", "but", "by", "not", "we", "can", "an",
  "your", "our", "about", "would", "or", "from", "just", "so", "if", "their", "will", "was",
  "me", "very", "too", "has", "more", "out", "been", "get", "when", "how", "up", "than",
  "some", "they", "here", "there", "what", "really", "very", "much", "good", "great",
  "like", "love", "would", "want", "went", "back", "time", "day", "days"
]);

// Heuristics for sentiment words
const POSITIVE_WORDS = [
  "love", "great", "excellent", "awesome", "perfect", "good", "happy", "thanks",
  "thank you", "amazing", "best", "wonderful", "nice", "easy", "satisfied", "enjoy",
  "helpful", "glad", "smooth", "intuitive", "brilliant", "fan", "fantastic"
];

const NEGATIVE_WORDS = [
  "slow", "bug", "bad", "worst", "broken", "annoying", "frustrated", "confusing",
  "fail", "error", "poor", "hate", "terrible", "issue", "crash", "expensive",
  "cost", "useless", "disappointed", "unable to", "cannot", "hard", "pain",
  "annoyed", "frustrating", "waste", "garbage", "rubbish"
];

const URGENT_WORDS = [
  "urgent", "immediately", "block", "cannot", "critical", "emergency", "now",
  "furious", "angry", "asap", "stop", "stuck", "prevent", "broken", "billing", "down"
];

/**
 * Normalizes text for matching.
 */
function normalizeText(text: string): string {
  return (text || "").toLowerCase().trim();
}

/**
 * Matches keyword list against text.
 */
function containsKeyword(normalizedText: string, keywords: string[]): boolean {
  return keywords.some((kw) => {
    if (kw.includes(" ")) {
      return normalizedText.includes(kw);
    }
    // Match word boundaries for single keywords
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    return regex.test(normalizedText);
  });
}

/**
 * Classifies the sentiment of the text.
 */
export function classifySentiment(text: string, ratingStr?: string, maxRating: number = 5): SentimentType {
  if (ratingStr) {
    const ratingVal = parseFloat(ratingStr);
    if (!isNaN(ratingVal)) {
      if (maxRating === 5) {
        if (ratingVal >= 4) return "positive";
        if (ratingVal === 3) return "neutral";
        return "negative";
      } else if (maxRating === 10) {
        if (ratingVal >= 9) return "positive";
        if (ratingVal >= 7) return "neutral";
        return "negative";
      } else {
        if (ratingVal >= 70) return "positive";
        if (ratingVal >= 40) return "neutral";
        return "negative";
      }
    }
  }

  const norm = normalizeText(text);
  let posCount = 0;
  let negCount = 0;

  const POS_STEMS = [
    "lov", "great", "excel", "awesom", "perfect", "good", "happ", "thank",
    "amaz", "best", "wonder", "nice", "easy", "satisf", "enjoy",
    "help", "glad", "smooth", "intuit", "bril", "fantast"
  ];

  const NEG_STEMS = [
    "slow", "sluggish", "bug", "bad", "worst", "brok", "annoy", "frustrat",
    "confus", "fail", "error", "poor", "hate", "terrib", "issue", "crash",
    "expens", "cost", "usel", "disappoint", "unable", "cannot", "hard",
    "pain", "wast", "garbag", "rubbish"
  ];

  POS_STEMS.forEach((w) => {
    const matches = norm.match(new RegExp(`\\b${w}\\w*`, "g"));
    if (matches) posCount += matches.length;
  });

  const NEG_WORDS_STEM = NEG_STEMS.concat(["brok"]);
  NEG_WORDS_STEM.forEach((w) => {
    const matches = norm.match(new RegExp(`\\b${w}\\w*`, "g"));
    if (matches) negCount += matches.length;
  });

  if (posCount > negCount) return "positive";
  if (negCount > posCount) return "negative";
  return "neutral";
}

/**
 * Extracts dynamic categories based on keyword frequency in non-positive reviews.
 */
export function extractDynamicCategories(
  rows: CsvRow[],
  columnMap: Record<string, string>
): string[] {
  const textCol = columnMap.feedback || "";
  if (!textCol || rows.length === 0) {
    return ["General Feedback"];
  }

  const wordCounts: Record<string, number> = {};

  rows.forEach((row) => {
    const text = (row[textCol] || "").toLowerCase();
    
    // Focus on negative and neutral comments to find problems
    const ratingCol = columnMap.rating;
    const ratingVal = ratingCol ? row[ratingCol] || "" : "";
    const sentiment = classifySentiment(text, ratingVal);
    if (sentiment === "positive") return;

    const words = text
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
      .split(/\s+/);

    words.forEach((word) => {
      const cleaned = word.trim();
      if (cleaned.length > 3 && !STOP_WORDS.has(cleaned)) {
        wordCounts[cleaned] = (wordCounts[cleaned] || 0) + 1;
      }
    });
  });

  // Sort and get top 4 keywords
  const topKeywords = Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([word]) => word);

  if (topKeywords.length === 0) {
    return ["General Feedback"];
  }

  const categories = topKeywords.map(
    (kw) => kw.charAt(0).toUpperCase() + kw.slice(1) + " Issues"
  );
  categories.push("General Feedback");
  return categories;
}

/**
 * Matches keyword against text to detect dynamic category.
 */
export function detectDynamicCategory(text: string, categories: string[]): string {
  const norm = normalizeText(text);

  for (let i = 0; i < categories.length - 1; i++) {
    const cat = categories[i];
    const keyword = cat.split(" ")[0].toLowerCase();
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(norm)) {
      return cat;
    }
  }

  return categories[categories.length - 1]; // General Feedback
}

export function detectCategory(text: string, categories?: string[]): string {
  if (categories && categories.length > 0) {
    return detectDynamicCategory(text, categories);
  }
  return "General Feedback";
}

/**
 * Calculates feedback urgency.
 */
export function detectUrgency(text: string, sentiment: SentimentType): UrgencyType {
  const norm = normalizeText(text);

  if (sentiment === "negative") {
    if (containsKeyword(norm, URGENT_WORDS)) {
      return "high";
    }
    return "medium";
  }

  if (sentiment === "neutral" && containsKeyword(norm, URGENT_WORDS)) {
    return "medium";
  }

  return "low";
}

/**
 * Analyzes a single feedback row.
 */
export function analyzeFeedbackItem(
  row: CsvRow,
  index: number,
  columnMap: Record<string, string>,
  categories: string[] = ["General Feedback"]
): AnalyzedFeedbackItem {
  const textCol = columnMap.feedback || "";
  const dateCol = columnMap.date || "";
  const sourceCol = columnMap.source || "";
  const segmentCol = columnMap.segment || "";
  const ratingCol = columnMap.rating || "";

  const textVal = row[textCol] || "";
  const dateVal = row[dateCol] || "";
  const sourceVal = row[sourceCol] || "Unknown";
  const segmentVal = row[segmentCol] || "General";
  const ratingVal = ratingCol ? row[ratingCol] || "" : "";

  let maxRating = 5;
  if (ratingVal) {
    const val = parseFloat(ratingVal);
    if (!isNaN(val)) {
      if (val > 10) maxRating = 100;
      else if (val > 5) maxRating = 10;
    }
  }

  const sentiment = classifySentiment(textVal, ratingVal, maxRating);
  const category = detectCategory(textVal, categories);
  const urgency = detectUrgency(textVal, sentiment);

  return {
    id: `item-${index}`,
    feedbackText: textVal,
    date: dateVal,
    source: sourceVal,
    segment: segmentVal,
    category,
    sentiment,
    urgency,
    originalRow: row,
  };
}

/**
 * Extracts top problem keywords from negative feedback.
 */
function extractTopKeywords(items: AnalyzedFeedbackItem[]): KeywordStat[] {
  const wordCounts: Record<string, number> = {};
  
  items
    .filter((item) => item.sentiment === "negative")
    .forEach((item) => {
      const words = item.feedbackText
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
        .split(/\s+/);

      words.forEach((word) => {
        const cleaned = word.trim();
        if (cleaned.length > 3 && !STOP_WORDS.has(cleaned)) {
          wordCounts[cleaned] = (wordCounts[cleaned] || 0) + 1;
        }
      });
    });

  return Object.entries(wordCounts)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/**
 * Analyzes the entire dataset of CsvRows.
 */
export function analyzeFeedbackDataset(
  rows: CsvRow[],
  columnMap: Record<string, string>
): AnalysisResult {
  let maxRating = 5;
  const ratingCol = columnMap.rating;
  if (ratingCol) {
    const vals = rows.map((r) => parseFloat(r[ratingCol])).filter((v) => !isNaN(v));
    if (vals.length > 0) {
      const maxVal = Math.max(...vals);
      if (maxVal > 10) maxRating = 100;
      else if (maxVal > 5) maxRating = 10;
      else maxRating = 5;
    }
  }

  const dynamicCategories = extractDynamicCategories(rows, columnMap);

  const items = rows.map((row, idx) => {
    const textCol = columnMap.feedback || "";
    const dateCol = columnMap.date || "";
    const sourceCol = columnMap.source || "";
    const segmentCol = columnMap.segment || "";

    const textVal = row[textCol] || "";
    const dateVal = row[dateCol] || "";
    const sourceVal = row[sourceCol] || "Unknown";
    const segmentVal = row[segmentCol] || "General";
    const ratingVal = ratingCol ? row[ratingCol] || "" : "";

    const sentiment = classifySentiment(textVal, ratingVal, maxRating);
    const category = detectCategory(textVal, dynamicCategories);
    const urgency = detectUrgency(textVal, sentiment);

    return {
      id: `item-${idx}`,
      feedbackText: textVal,
      date: dateVal,
      source: sourceVal,
      segment: segmentVal,
      category,
      sentiment,
      urgency,
      originalRow: row,
    };
  });

  const totalCount = items.length;

  let pos = 0;
  let neu = 0;
  let neg = 0;

  items.forEach((item) => {
    if (item.sentiment === "positive") pos++;
    else if (item.sentiment === "neutral") neu++;
    else if (item.sentiment === "negative") neg++;
  });

  const positivePercentage = totalCount ? Math.round((pos / totalCount) * 100) : 0;
  const neutralPercentage = totalCount ? Math.round((neu / totalCount) * 100) : 0;
  const negativePercentage = totalCount ? Math.round((neg / totalCount) * 100) : 0;

  const averageSentimentScore = totalCount
    ? Math.round(((pos * 100 + neu * 50) / totalCount))
    : 50;

  const categoryMap: Record<string, CategoryStats> = {};
  dynamicCategories.forEach((cat) => {
    categoryMap[cat] = {
      name: cat,
      count: 0,
      sentiment: { positive: 0, neutral: 0, negative: 0 },
    };
  });

  items.forEach((item) => {
    const cat = item.category;
    if (!categoryMap[cat]) {
      categoryMap[cat] = {
        name: cat,
        count: 0,
        sentiment: { positive: 0, neutral: 0, negative: 0 },
      };
    }
    categoryMap[cat].count++;
    categoryMap[cat].sentiment[item.sentiment]++;
  });

  const categoryStats = Object.values(categoryMap).sort((a, b) => b.count - a.count);
  const topKeywords = extractTopKeywords(items);

  const urgentComplaints = items
    .filter((item) => item.urgency === "high")
    .sort((a, b) => b.feedbackText.length - a.feedbackText.length)
    .slice(0, 5);

  return {
    items,
    totalCount,
    averageSentimentScore,
    sentimentDistribution: {
      positive: pos,
      neutral: neu,
      negative: neg,
      positivePercentage,
      neutralPercentage,
      negativePercentage,
    },
    categoryStats,
    topKeywords,
    urgentComplaints,
  };
}

export interface CategoryDetails {
  categoryName: string;
  totalCount: number;
  sentimentDistribution: SentimentDistribution;
  segmentsAffected: Record<string, number>;
  sourcesAffected: Record<string, number>;
  topQuotes: AnalyzedFeedbackItem[];
  recurringKeywords: KeywordStat[];
  heuristicRecommendation: {
    title: string;
    actionText: string;
    priority: string;
  };
}

export function getRecommendationForCategory(categoryName: string): { title: string; actionText: string; priority: string } {
  const norm = (categoryName || "").toLowerCase();
  
  if (norm.includes("battery") || norm.includes("power") || norm.includes("charge") || norm.includes("charging")) {
    return {
      title: `${categoryName} Optimization & Thermal Review`,
      actionText: `Perform technical review of power usage metrics, battery drain rates, thermal profiles, and charging latency. Focus on firmware enhancements.`,
      priority: "High"
    };
  }
  if (norm.includes("screen") || norm.includes("display") || norm.includes("pixel") || norm.includes("tint") || norm.includes("calibration") || norm.includes("glass")) {
    return {
      title: `${categoryName} Firmware Calibration Patch`,
      actionText: `Analyze screen tint color presets, hardware touch latency, and panel refreshing loops. Liaise with display subsystem engineers.`,
      priority: "High"
    };
  }
  if (norm.includes("engine") || norm.includes("drivetrain") || norm.includes("transmission") || norm.includes("clutch") || norm.includes("gear")) {
    return {
      title: `${categoryName} Quality Diagnostics & Mechanical Audit`,
      actionText: `Schedule mechanical inspection of drivetrain links and run engine control unit (ECU) signal calibration tests to debug efficiency logs.`,
      priority: "High"
    };
  }
  if (norm.includes("steering") || norm.includes("brake") || norm.includes("braking") || norm.includes("wheel") || norm.includes("tire") || norm.includes("suspension")) {
    return {
      title: `${categoryName} Core Safety System Audit`,
      actionText: `Log critical quality control ticket to review steering column wear tolerances and braking deceleration sensors. Ensure physical safety compliance.`,
      priority: "Critical"
    };
  }
  if (norm.includes("video") || norm.includes("player") || norm.includes("buffering") || norm.includes("stream") || norm.includes("playback")) {
    return {
      title: `${categoryName} Latency & Bitrate Tuning`,
      actionText: `Configure HTTP Live Streaming (HLS) adaptive bitrates. Optimize video segment chunk sizes and caching headers at the CDN edge layer.`,
      priority: "Medium"
    };
  }
  if (norm.includes("quiz") || norm.includes("exam") || norm.includes("test") || norm.includes("certificate") || norm.includes("completion")) {
    return {
      title: `${categoryName} LMS System Reliability Audit`,
      actionText: `Debug database insert race conditions and completion hooks. Ensure certificates generate atomically immediately following exam grade events.`,
      priority: "High"
    };
  }
  if (norm.includes("billing") || norm.includes("cost") || norm.includes("price") || norm.includes("pay") || norm.includes("money") || norm.includes("subscription")) {
    return {
      title: `${categoryName} Gateway Integration Review`,
      actionText: `Audit Stripe checkout webhooks and payment logs to prevent duplicate charges or plan sync latency. Clear checkout friction.`,
      priority: "High"
    };
  }
  if (norm.includes("crash") || norm.includes("bug") || norm.includes("freeze") || norm.includes("error") || norm.includes("glitch")) {
    return {
      title: `${categoryName} Exception Monitoring & Fix Pipeline`,
      actionText: `Audit client-side error boundaries and stack traces. Add memory leak checks and garbage collection overrides to stabilize transitions.`,
      priority: "High"
    };
  }
  if (norm.includes("feed") || norm.includes("load") || norm.includes("scroll") || norm.includes("refresh") || norm.includes("share") || norm.includes("post") || norm.includes("social")) {
    return {
      title: `${categoryName} Graph & API Cache Tuning`,
      actionText: `Integrate distributed memory caching (Redis) for write-heavy timeline feeds. Defer non-critical rendering blocks to main thread idle gaps.`,
      priority: "Medium"
    };
  }
  if (norm.includes("support") || norm.includes("help") || norm.includes("service") || norm.includes("customer")) {
    return {
      title: `${categoryName} Operations Workflow Tuning`,
      actionText: `Audit support response delays and ticket queue routing rules. Provide helpdesk guides and run agent training sprints.`,
      priority: "Medium"
    };
  }

  return {
    title: `${categoryName} Aspect Analysis Spec`,
    actionText: `Review qualitative user feedback clusters to trace root issues inside ${categoryName} and coordinate corrective engineering sprints.`,
    priority: "Medium"
  };
}

export function analyzeCategoryDetails(
  items: AnalyzedFeedbackItem[],
  categoryName: string
): CategoryDetails {
  const trimmedTarget = (categoryName || "").trim();
  const catItems = items.filter((item) => (item.category || "").trim() === trimmedTarget);
  const totalCount = catItems.length;

  let pos = 0;
  let neu = 0;
  let neg = 0;

  catItems.forEach((item) => {
    if (item.sentiment === "positive") pos++;
    else if (item.sentiment === "neutral") neu++;
    else if (item.sentiment === "negative") neg++;
  });

  const positivePercentage = totalCount ? Math.round((pos / totalCount) * 100) : 0;
  const neutralPercentage = totalCount ? Math.round((neu / totalCount) * 100) : 0;
  const negativePercentage = totalCount ? Math.round((neg / totalCount) * 100) : 0;

  const segmentsAffected: Record<string, number> = {};
  const sourcesAffected: Record<string, number> = {};

  catItems.forEach((item) => {
    const seg = item.segment || "General";
    const src = item.source || "Unknown";
    segmentsAffected[seg] = (segmentsAffected[seg] || 0) + 1;
    sourcesAffected[src] = (sourcesAffected[src] || 0) + 1;
  });

  const topQuotes = [...catItems]
    .sort((a, b) => {
      const sentimentScore = (s: string) => (s === "negative" ? 3 : s === "neutral" ? 2 : 1);
      const scoreA = sentimentScore(a.sentiment);
      const scoreB = sentimentScore(b.sentiment);
      if (scoreA !== scoreB) return scoreB - scoreA;
      return b.feedbackText.length - a.feedbackText.length;
    })
    .slice(0, 10);

  const wordCounts: Record<string, number> = {};
  catItems.forEach((item) => {
    const words = item.feedbackText
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
      .split(/\s+/);

    words.forEach((word) => {
      const cleaned = word.trim();
      if (cleaned.length > 3 && !STOP_WORDS.has(cleaned)) {
        wordCounts[cleaned] = (wordCounts[cleaned] || 0) + 1;
      }
    });
  });

  const recurringKeywords = Object.entries(wordCounts)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const heuristicRecommendation = getRecommendationForCategory(categoryName);

  return {
    categoryName,
    totalCount,
    sentimentDistribution: {
      positive: pos,
      neutral: neu,
      negative: neg,
      positivePercentage,
      neutralPercentage,
      negativePercentage,
    },
    segmentsAffected,
    sourcesAffected,
    topQuotes,
    recurringKeywords,
    heuristicRecommendation,
  };
}

