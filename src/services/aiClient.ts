import {
  AnalyzedFeedbackItem,
  AnalysisResult,
  CategoryStats,
  KeywordStat,
  SentimentDistribution,
  SentimentType,
  UrgencyType,
  CsvRow,
  classifySentiment,
  detectCategory,
  detectUrgency,
  extractDynamicCategories,
  getRecommendationForCategory
} from "../utils/heuristicAnalyzer";

export const CATEGORIES: string[] = []; // Kept as empty for backwards compatibility

interface OpenAIClassificationResponse {
  classifications: Array<{
    id: string;
    sentiment: SentimentType;
    category: string;
    urgency: UrgencyType;
    confidence: number;
  }>;
}

interface OpenAISummaryResponse {
  recurringKeywords: Array<{ text: string; count: number }>;
  heuristicRecommendation: {
    title: string;
    actionText: string;
    priority: string;
  };
  topQuotes: Array<{ id: string; text: string }>;
}

/**
 * Helper to simulate progress delay
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs the AI analysis. Defaults to simulation if API key is not provided.
 */
export async function runAiAnalysis(
  rows: CsvRow[],
  columnMap: Record<string, string>,
  apiKey: string | null,
  onProgress: (percent: number) => void
): Promise<AnalysisResult> {
  const isSimulated = !apiKey || apiKey.trim() === "";

  if (isSimulated) {
    return runSimulatedAnalysis(rows, columnMap, onProgress);
  } else {
    return runGeminiAnalysis(rows, columnMap, apiKey as string, onProgress);
  }
}

/**
 * Simulated AI Analysis with network progress bars.
 */
async function runSimulatedAnalysis(
  rows: CsvRow[],
  columnMap: Record<string, string>,
  onProgress: (percent: number) => void
): Promise<AnalysisResult> {
  const totalCount = rows.length;
  const items: AnalyzedFeedbackItem[] = [];

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

  // Step 1: Simulate row classification in batches
  const batchSize = Math.ceil(totalCount / 5) || 1;
  for (let i = 0; i < totalCount; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    chunk.forEach((row, index) => {
      const idx = i + index;
      
      const textCol = columnMap.feedback || "";
      const dateCol = columnMap.date || "";
      const sourceCol = columnMap.source || "";
      const segmentCol = columnMap.segment || "";

      const textVal = row[textCol] || "";
      const dateVal = row[dateCol] || "";
      const sourceVal = row[sourceCol] || "Unknown";
      const segmentVal = row[segmentCol] || "General";
      const ratingVal = ratingCol ? row[ratingCol] || "" : "";

      // Re-use heuristic logic but add a slight variance
      const sentiment = classifySentiment(textVal, ratingVal, maxRating);
      const category = detectCategory(textVal, dynamicCategories);
      const urgency = detectUrgency(textVal, sentiment);

      items.push({
        id: `ai-item-${idx}`,
        feedbackText: textVal,
        date: dateVal,
        source: sourceVal,
        segment: segmentVal,
        category,
        sentiment,
        urgency,
        originalRow: row,
      });
    });

    const percent = Math.min(Math.round(((i + batchSize) / totalCount) * 80), 80);
    onProgress(percent);
    await delay(300); // Simulate network wait
  }

  // Step 2: Aggregate values
  onProgress(90);
  await delay(200);

  const stats = compileAnalysisResult(items);
  
  onProgress(100);
  return stats;
}

/**
 * Live Gemini API Analysis.
 */
async function runGeminiAnalysis(
  rows: CsvRow[],
  columnMap: Record<string, string>,
  apiKey: string,
  onProgress: (percent: number) => void
): Promise<AnalysisResult> {
  const totalCount = rows.length;
  const items: AnalyzedFeedbackItem[] = [];
  const batchSize = 25;

  const textCol = columnMap.feedback || "";
  const dateCol = columnMap.date || "";
  const sourceCol = columnMap.source || "";
  const segmentCol = columnMap.segment || "";

  const dynamicCategories = extractDynamicCategories(rows, columnMap);

  // Step 1: Classify all rows in batches of 25
  for (let i = 0; i < totalCount; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    
    // Prepare classification prompt
    const promptInputs = chunk.map((row, idx) => ({
      id: `ai-item-${i + idx}`,
      text: row[textCol] || ""
    }));

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are a customer feedback classifier. Categorize each feedback item.
Input data is a JSON array of items, each with an 'id' and 'text'.
For each item, classify:
- sentiment: "positive", "neutral", or "negative"
- category: one of the following dynamic categories: ${dynamicCategories.map(c => `"${c}"`).join(", ")}
- urgency: "low", "medium", or "high"
- confidence: a float from 0 to 1 indicating your confidence in classification

Input data array:
${JSON.stringify(promptInputs)}`
              }]
            }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  classifications: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        id: { type: "STRING" },
                        sentiment: { type: "STRING", enum: ["positive", "neutral", "negative"] },
                        category: { type: "STRING", enum: dynamicCategories },
                        urgency: { type: "STRING", enum: ["low", "medium", "high"] },
                        confidence: { type: "NUMBER" }
                      },
                      required: ["id", "sentiment", "category", "urgency", "confidence"]
                    }
                  }
                },
                required: ["classifications"]
              }
            }
          })
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API returned error: ${response.status} - ${errText}`);
      }

      const resData = await response.json();
      const contentText = resData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const apiResponse: OpenAIClassificationResponse = JSON.parse(contentText);

      const classifications = apiResponse.classifications || [];
      const classMap = new Map(classifications.map((c) => [c.id, c]));

      chunk.forEach((row, idx) => {
        const itemId = `ai-item-${i + idx}`;
        const textVal = row[textCol] || "";
        const dateVal = row[dateCol] || "";
        const sourceVal = row[sourceCol] || "Unknown";
        const segmentVal = row[segmentCol] || "General";

        const match = classMap.get(itemId);
        
        items.push({
          id: itemId,
          feedbackText: textVal,
          date: dateVal,
          source: sourceVal,
          segment: segmentVal,
          category: match?.category || "General Feedback",
          sentiment: match?.sentiment || "neutral",
          urgency: match?.urgency || "low",
          originalRow: row,
        });
      });

    } catch (e) {
      console.error("Gemini Batch Ingestion Error, falling back to heuristics for this batch", e);
      // Fallback to local heuristic for this batch
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

      chunk.forEach((row, idx) => {
        const textVal = row[textCol] || "";
        const dateVal = row[dateCol] || "";
        const sourceVal = row[sourceCol] || "Unknown";
        const segmentVal = row[segmentCol] || "General";
        const ratingVal = ratingCol ? row[ratingCol] || "" : "";

        const sentiment = classifySentiment(textVal, ratingVal, maxRating);
        const category = detectCategory(textVal, dynamicCategories);
        const urgency = detectUrgency(textVal, sentiment);

        items.push({
          id: `ai-item-${i + idx}`,
          feedbackText: textVal,
          date: dateVal,
          source: sourceVal,
          segment: segmentVal,
          category,
          sentiment,
          urgency,
          originalRow: row,
        });
      });
    }

    const progress = Math.min(Math.round(((i + batchSize) / totalCount) * 90), 90);
    onProgress(progress);
  }

  // Step 2: Final aggregates compilation
  onProgress(95);
  const result = compileAnalysisResult(items);
  onProgress(100);
  return result;
}

/**
 * Summarizes category details using Gemini or local overrides.
 */
export async function runCategoryAISummary(
  categoryName: string,
  items: AnalyzedFeedbackItem[],
  apiKey: string | null
): Promise<OpenAISummaryResponse> {
  const isSimulated = !apiKey || apiKey.trim() === "";
  const catItems = items.filter((item) => item.category === categoryName);

  if (isSimulated) {
    await delay(100);
    return generateLocalCategorySummary(categoryName, catItems);
  }

  try {
    const inputTexts = catItems.slice(0, 15).map((i) => ({ id: i.id, text: i.feedbackText }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a product management assistant. You analyze feedback items for category "${categoryName}".
Generate recurring keywords (up to 8, with hit counts), a structured product recommendation, and select top quotes representing the category.
Here is the input data:
${JSON.stringify(inputTexts)}`
            }]
          }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                recurringKeywords: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      text: { type: "STRING" },
                      count: { type: "INTEGER" }
                    },
                    required: ["text", "count"]
                  }
                },
                heuristicRecommendation: {
                  type: "OBJECT",
                  properties: {
                    title: { type: "STRING" },
                    actionText: { type: "STRING" },
                    priority: { type: "STRING", enum: ["Low", "Medium", "High", "Critical"] }
                  },
                  required: ["title", "actionText", "priority"]
                },
                topQuotes: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      id: { type: "STRING" },
                      text: { type: "STRING" }
                    },
                    required: ["id", "text"]
                  }
                }
              },
              required: ["recurringKeywords", "heuristicRecommendation", "topQuotes"]
            }
          }
        })
      }
    );

    if (!response.ok) throw new Error("Gemini summary call failed");
    
    const resData = await response.json();
    const contentText = resData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const apiResponse: OpenAISummaryResponse = JSON.parse(contentText);

    // Merge quotes to get original segment/date metadata
    const quoteMap = new Map(catItems.map((i) => [i.id, i]));
    const topQuotesMerged = (apiResponse.topQuotes || [])
      .map((q) => quoteMap.get(q.id))
      .filter((q): q is AnalyzedFeedbackItem => !!q);

    return {
      recurringKeywords: apiResponse.recurringKeywords || [],
      heuristicRecommendation: apiResponse.heuristicRecommendation || {
        title: "Action Needed",
        actionText: "Check comments for details.",
        priority: "Medium"
      },
      topQuotes: topQuotesMerged.length ? topQuotesMerged : catItems.slice(0, 5)
    };

  } catch (e) {
    console.error("Gemini summary failed, falling back to local builder", e);
    return generateLocalCategorySummary(categoryName, catItems);
  }
}

/**
 * Fallback / Simulated Category Summarizer.
 */
function generateLocalCategorySummary(
  categoryName: string,
  catItems: AnalyzedFeedbackItem[]
): OpenAISummaryResponse {
  // Extract keywords
  const STOP_WORDS = new Set([
    "the", "and", "a", "of", "to", "is", "in", "it", "that", "you", "for", "on", "with",
    "this", "my", "have", "are", "as", "at", "be", "but", "by", "not", "we", "can", "an",
    "your", "our", "about", "would", "or", "from", "just", "so", "if"
  ]);

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

  const topQuotes = [...catItems]
    .sort((a, b) => {
      const score = (s: string) => (s === "negative" ? 3 : s === "neutral" ? 2 : 1);
      return score(b.sentiment) - score(a.sentiment);
    })
    .slice(0, 8);

  return {
    recurringKeywords,
    heuristicRecommendation: getRecommendationForCategory(categoryName),
    topQuotes
  };
}

/**
 * Compiles rows to the final aggregates data structure.
 */
function compileAnalysisResult(items: AnalyzedFeedbackItem[]): AnalysisResult {
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
  CATEGORIES.forEach((cat) => {
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

  // Keyword extraction from negative comments
  const wordCounts: Record<string, number> = {};
  const STOP_WORDS = new Set(["the", "and", "a", "of", "to", "is", "in", "it", "that", "you", "for", "on", "with", "this", "my", "have", "are", "as", "at", "be", "but", "by", "not", "we", "can", "an", "your", "our", "about", "would", "or", "from", "just", "so", "if"]);
  
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

  const topKeywords = Object.entries(wordCounts)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

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

/**
 * Live Gemini API call to analyze an individual quote.
 */
export async function fetchQuoteAdviceFromGemini(
  quoteText: string,
  category: string,
  apiKey: string
): Promise<{ explanation: string; cause: string; solution: string }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a Senior Product Manager and System Architect.
Analyze the following customer feedback comment under the category "${category}":
"${quoteText}"

Provide a highly detailed, professional, and engineering-ready analysis in JSON format containing:
1. "explanation": A thorough, comprehensive explanation of the user's problem (minimum 2 detailed sentences).
2. "cause": A deep technical assessment of what exactly caused this problem (e.g., physical wear, hardware defects, firmware locks, software race conditions, database contention, or network issues).
3. "solution": Actionable, concrete engineering steps on how to solve this problem. Provide a detailed, step-by-step implementation guide with clear instructions, code patterns, database schemas, or mechanical/electrical checks (minimum 3 bullet points, each with 2-3 sentences of deep technical detail).

Make your analysis extremely specific, detailed, and technically rich.`
          }]
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              explanation: { type: "STRING" },
              cause: { type: "STRING" },
              solution: { type: "STRING" }
            },
            required: ["explanation", "cause", "solution"]
          }
        }
      })
    }
  );

  if (!response.ok) throw new Error("Gemini API call failed");
  const resData = await response.json();
  const text = resData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return JSON.parse(text);
}

/**
 * Fallback local template advice for individual quotes based on keyword matches.
 */
export function generateLocalQuoteAdvice(
  quoteText: string,
  category: string
): { explanation: string; cause: string; solution: string } {
  const norm = quoteText.toLowerCase();

  if (category === "Cars" || category === "Automotive & Cars" || norm.includes("car") || norm.includes("vehicle") || norm.includes("auto") || norm.includes("engine") || norm.includes("steering") || norm.includes("battery") || norm.includes("ev")) {
    return {
      explanation: `The customer is experiencing a technical issue with their vehicle or related dealership services. Specific user report: "${quoteText}".`,
      cause: "This issue typically arises from mechanical component wear, physical assembly faults (such as steering column misalignment), or unoptimized firmware parameters in the engine control unit (ECU) or Battery Management System (BMS).",
      solution: "1. Log an engineering service ticket to perform a physical inspection of the steering and drivetrain systems.\n2. Schedule a firmware update patch to optimize battery thermal management and charge cycles.\n3. Verify dealership service logs to ensure correct installation parameters are followed during regular maintenance checkups."
    };
  }

  if (category === "Mobiles" || category === "Mobiles & Devices" || norm.includes("phone") || norm.includes("device") || norm.includes("screen") || norm.includes("camera") || norm.includes("bluetooth") || norm.includes("wifi")) {
    return {
      explanation: `The user reports a hardware malfunction or firmware bug on their mobile device. Specific user report: "${quoteText}".`,
      cause: "This can be traced to uncalibrated screen color profiles (tint issues), hardware buffer overflows causing the camera application to crash under stress, or Bluetooth driver conflicts inside the operating system's device peripheral controller stack.",
      solution: "1. Integrate factory color calibration overrides in the next software maintenance release to fix screen tinting.\n2. Add memory garbage collection checkpoints during camera state transitions to prevent buffer timeouts.\n3. Refactor peripheral handshake routines to allow graceful reconnects when Bluetooth packets are dropped."
    };
  }

  if (category === "Social Media" || category === "Social Media & Apps" || norm.includes("social") || norm.includes("post") || norm.includes("feed") || norm.includes("comment") || norm.includes("share") || norm.includes("profile")) {
    return {
      explanation: `The user is reporting functional glitches or performance lags on a social media platform. Specific user report: "${quoteText}".`,
      cause: "This issue is caused by backend query timeouts during social graph retrievals, lack of request queuing in write-heavy endpoints (likes, shares, posts), or media uploading failures on CDN pipelines.",
      solution: "1. Implement a distributed cache layer (e.g. Redis) to serve feed queries instantly without touching the primary database.\n2. Introduce background message queuing for post/share updates to handle high usage spikes gracefully.\n3. Wrap feed layout containers in strict null-safety checks to prevent media parsing errors from crashing the user interface."
    };
  }

  if (category === "Courses" || category === "Courses & Education" || norm.includes("course") || norm.includes("learn") || norm.includes("lecture") || norm.includes("exam") || norm.includes("certificate")) {
    return {
      explanation: `The student is experiencing difficulty with online learning materials or course platform software. Specific user report: "${quoteText}".`,
      cause: "Often caused by network bandwidth constraints during video lecture playback without adaptive streaming, database race conditions during automatic certificate generation, or outdated content instruction schemas.",
      solution: "1. Implement HTTP Live Streaming (HLS) with adaptive bitrate options to eliminate video player buffering issues.\n2. Audit certificate generation backend hooks to ensure certificate records are inserted atomically after exam grades are saved.\n3. Set up a regular course content review schedule to identify confusing lab assignments and clarify syllabus modules."
    };
  }

  return {
    explanation: `The user reports a problem regarding products/services in the ${category} category: "${quoteText}".`,
    cause: `The system detected a user experience friction point or functional blocker within the ${category} workflow layer.`,
    solution: `1. Audit the user's specific comment and match it against recent component release notes.\n2. Conduct manual QA tests to replicate the user journey and identify layout/performance bugs.\n3. Formulate design specs to optimize user satisfaction.`
  };
}
