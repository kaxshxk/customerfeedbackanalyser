import { AnalyzedFeedbackItem, CategoryStats } from "./heuristicAnalyzer";

export interface ICSWeights {
  frequency: number;
  segment: number;
  sentiment: number;
  trend: number;
}

export interface ICSCategoryResult {
  name: string;
  icsScore: number;
  priority: "Critical" | "High" | "Medium" | "Low";
  whyThisMatters: string;
  scores: {
    frequency: number;
    segment: number;
    sentiment: number;
    trend: number;
  };
}

export const DEFAULT_WEIGHTS: ICSWeights = {
  frequency: 30,
  segment: 30,
  sentiment: 20,
  trend: 20,
};

/**
 * Parses simple date strings to timestamp. Returns null if invalid or missing.
 */
function parseDateToTime(dateStr: string): number | null {
  if (!dateStr || dateStr.trim() === "") return null;
  const t = Date.parse(dateStr);
  return isNaN(t) ? null : t;
}

/**
 * Calculates the Impact Confidence Score (ICS) for each category.
 */
export function calculateICS(
  items: AnalyzedFeedbackItem[],
  categoryStats: CategoryStats[],
  weights: ICSWeights
): ICSCategoryResult[] {
  const maxCount = Math.max(...categoryStats.map((c) => c.count)) || 1;
  const totalCount = items.length || 1;

  // Segment values coefficients mapping
  const segmentValueMap: Record<string, number> = {
    // Enterprise/B2B large tiers
    Enterprise: 100,
    Corporate: 100,
    Premium: 100,
    "Fleet Customer": 100,
    "Luxury Buyer": 100,
    
    // Medium tiers
    Growth: 60,
    Professional: 60,
    "Repeat Customer": 60,
    Academic: 60,
    
    // Standard / SMB tiers
    SMB: 30,
    Consumer: 30,
    Student: 30,
    "First-time Buyer": 30,
    "Trade-in Customer": 30,
    "Service Customer": 30,
    
    // Low tiers / other
    "Budget Buyer": 15,
    General: 15,
    Other: 15,
    Unknown: 15,
  };

  // Find min and max timestamps across the whole dataset for midpoint trend comparison
  let minTime = Infinity;
  let maxTime = -Infinity;
  items.forEach((item) => {
    const t = parseDateToTime(item.date);
    if (t !== null) {
      if (t < minTime) minTime = t;
      if (t > maxTime) maxTime = t;
    }
  });

  const hasTimeline = minTime !== Infinity && maxTime !== -Infinity && minTime !== maxTime;
  const midTime = hasTimeline ? (minTime + maxTime) / 2 : 0;

  return categoryStats.map((cat) => {
    const catItems = items.filter((item) => item.category === cat.name);
    const catCount = cat.count;

    // 1. Request Frequency (normalized against max count for better relative representation)
    const freqScore = catCount ? Math.round((catCount / maxCount) * 100) : 0;

    // 2. Revenue-weighted User Segment score
    let segmentScore = 15; // default fallback
    if (catItems.length > 0) {
      const sumSeg = catItems.reduce(
        (sum, item) => sum + (segmentValueMap[item.segment] ?? 15),
        0
      );
      segmentScore = Math.round(sumSeg / catItems.length);
    }

    // 3. Sentiment Severity (percentage of negative comments in this category)
    const sentimentScore = catCount
      ? Math.round((cat.sentiment.negative / catCount) * 100)
      : 0;

    // 4. Recency Trend (proportion of items in the second half of the dataset timeline)
    let trendScore = 50; // stable fallback
    if (hasTimeline && catItems.length > 0) {
      let newerCount = 0;
      let olderCount = 0;
      catItems.forEach((item) => {
        const t = parseDateToTime(item.date);
        if (t !== null) {
          if (t >= midTime) newerCount++;
          else olderCount++;
        }
      });
      const totalDated = newerCount + olderCount;
      if (totalDated > 0) {
        trendScore = Math.round((newerCount / totalDated) * 100);
      }
    }

    // Weighted composite score (0-100)
    const weightSum =
      weights.frequency + weights.segment + weights.sentiment + weights.trend || 1;
    const rawICS =
      (weights.frequency * freqScore +
        weights.segment * segmentScore +
        weights.sentiment * sentimentScore +
        weights.trend * trendScore) /
      weightSum;
    const icsScore = Math.round(rawICS);

    // Prioritization labels
    let priority: "Critical" | "High" | "Medium" | "Low" = "Low";
    if (icsScore >= 80) priority = "Critical";
    else if (icsScore >= 60) priority = "High";
    else if (icsScore >= 40) priority = "Medium";

    // Generate explanatory "Why this matters" justification text
    const justification = buildWhyThisMatters({
      name: cat.name,
      icsScore,
      priority,
      freqScore,
      segmentScore,
      sentimentScore,
      trendScore,
      catCount,
    });

    return {
      name: cat.name,
      icsScore,
      priority,
      whyThisMatters: justification,
      scores: {
        frequency: freqScore,
        segment: segmentScore,
        sentiment: sentimentScore,
        trend: trendScore,
      },
    };
  });
}

interface JustificationInputs {
  name: string;
  icsScore: number;
  priority: string;
  freqScore: number;
  segmentScore: number;
  sentimentScore: number;
  trendScore: number;
  catCount: number;
}

function buildWhyThisMatters(inputs: JustificationInputs): string {
  const {
    name,
    icsScore,
    priority,
    freqScore,
    segmentScore,
    sentimentScore,
    trendScore,
    catCount,
  } = inputs;

  if (catCount === 0) {
    return `No issues have been recorded in this category yet.`;
  }

  // Find the driver(s)
  const drivers: string[] = [];

  if (freqScore >= 75) {
    drivers.push(`extreme volume (Frequency Score: ${freqScore}%)`);
  } else if (freqScore >= 50) {
    drivers.push(`high frequency (Frequency Score: ${freqScore}%)`);
  }

  if (segmentScore >= 75) {
    drivers.push(`heavy concentration among premium B2B Enterprise accounts (Segment Score: ${segmentScore}%)`);
  } else if (segmentScore >= 50) {
    drivers.push(`impact on Growth segment customers (Segment Score: ${segmentScore}%)`);
  }

  if (sentimentScore >= 75) {
    drivers.push(`highly severe customer frustration (Sentiment Severity: ${sentimentScore}%)`);
  } else if (sentimentScore >= 50) {
    drivers.push(`moderately negative customer sentiment (Sentiment Severity: ${sentimentScore}%)`);
  }

  if (trendScore >= 70) {
    drivers.push(`a strong upward acceleration in recent days (Trend Score: ${trendScore}%)`);
  }

  // Fallback if no specific score is highly elevated
  if (drivers.length === 0) {
    return `${name} is marked as ${priority} priority (ICS: ${icsScore}). It represents a moderate, stable signal (Volume: ${catCount} items) with standard segment distribution.`;
  }

  // Join list nicely
  let driverText = "";
  if (drivers.length === 1) {
    driverText = drivers[0];
  } else if (drivers.length === 2) {
    driverText = `${drivers[0]} and ${drivers[1]}`;
  } else {
    driverText = `${drivers.slice(0, -1).join(", ")}, and ${drivers[drivers.length - 1]}`;
  }

  return `${name} is prioritized as ${priority} (ICS: ${icsScore}) because of its ${driverText}. Immediate remediation is suggested.`;
}
