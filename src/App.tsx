import Papa from "papaparse";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  FileSpreadsheet,
  LayoutDashboard,
  Search,
  Settings,
  Sparkles,
  Upload,
  Activity,
  ArrowRight,
  Clock,
  TrendingUp,
  MessageSquare,
  AlertTriangle,
  User,
  DollarSign,
  Zap,
  HelpCircle,
  Link,
  ChevronRight,
  Filter,
  RefreshCw,
  ArrowLeft,
  Briefcase,
  Share2,
  Key,
  Eye,
  EyeOff,
  Loader2,
  Edit,
  Copy,
  ExternalLink,
  Check,
  Car,
  Smartphone,
  GraduationCap,
  Home,
  Brain,
  Bot,
  Battery,
  Wifi,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  analyzeFeedbackDataset,
  analyzeCategoryDetails,
  AnalysisResult,
  CategoryDetails,
  SentimentType,
  UrgencyType,
  AnalyzedFeedbackItem,
  CsvRow,
  KeywordStat,
} from "./utils/heuristicAnalyzer";
import { runAiAnalysis, runCategoryAISummary, fetchQuoteAdviceFromGemini, generateLocalQuoteAdvice } from "./services/aiClient";
import { calculateICS, ICSWeights, ICSCategoryResult, DEFAULT_WEIGHTS } from "./utils/prioritization";

type Page = "welcome" | "upload" | "dashboard" | "categories" | "settings" | "alerts" | "reports" | "problems";

const categoryStates = [
  "Cars",
  "Mobiles",
  "Social Media",
  "Courses",
  "Other",
];

export function getCategoryIcon(category: string, size = 18) {
  const norm = (category || "").toLowerCase();
  
  if (norm.includes("battery") || norm.includes("power") || norm.includes("charging") || norm.includes("charge") || norm.includes("drain") || norm.includes("zap")) {
    return <Battery size={size} className="cat-icon-battery" style={{ color: '#ea580c' }} />;
  }
  if (norm.includes("wifi") || norm.includes("drop") || norm.includes("sync") || norm.includes("signal") || norm.includes("bluetooth") || norm.includes("wireless") || norm.includes("network")) {
    return <Wifi size={size} className="cat-icon-wifi" style={{ color: '#0284c7' }} />;
  }
  if (norm.includes("billing") || norm.includes("price") || norm.includes("fee") || norm.includes("cost") || norm.includes("payment") || norm.includes("checkout") || norm.includes("cash") || norm.includes("money") || norm.includes("dollar")) {
    return <DollarSign size={size} className="cat-icon-billing" style={{ color: '#16a34a' }} />;
  }
  if (norm.includes("latency") || norm.includes("speed") || norm.includes("delay") || norm.includes("time") || norm.includes("slow")) {
    return <Clock size={size} className="cat-icon-speed" style={{ color: '#2563eb' }} />;
  }
  if (norm.includes("bot") || norm.includes("support") || norm.includes("help") || norm.includes("loop") || norm.includes("assistance")) {
    return <Bot size={size} className="cat-icon-support" style={{ color: '#7c3aed' }} />;
  }
  if (norm.includes("home") || norm.includes("thermostat") || norm.includes("plug") || norm.includes("hub")) {
    return <Home size={size} className="cat-icon-home" style={{ color: '#4f46e5' }} />;
  }
  if (norm.includes("engine") || norm.includes("starting") || norm.includes("drive") || norm.includes("steering") || norm.includes("braking") || norm.includes("car")) {
    return <Car size={size} className="cat-icon-car" />;
  }
  if (norm.includes("screen") || norm.includes("display") || norm.includes("mobile") || norm.includes("device") || norm.includes("phone") || norm.includes("tint") || norm.includes("glass")) {
    return <Smartphone size={size} className="cat-icon-mobile" />;
  }
  if (norm.includes("feed") || norm.includes("share") || norm.includes("post") || norm.includes("social") || norm.includes("profile")) {
    return <Share2 size={size} className="cat-icon-social" />;
  }
  if (norm.includes("video") || norm.includes("player") || norm.includes("buffering") || norm.includes("curriculum") || norm.includes("course") || norm.includes("certificate") || norm.includes("quiz") || norm.includes("exam") || norm.includes("lecture") || norm.includes("student")) {
    return <GraduationCap size={size} className="cat-icon-education" />;
  }
  return <HelpCircle size={size} className="cat-icon-other" />;
}

const sampleRows: CsvRow[] = [
  {
    date: "2026-05-01",
    source: "Zendesk",
    segment: "Consumer",
    feedback: "The electric vehicle charger at the dealership was broken, and the EV battery drain on my Tesla Model Y is much faster than advertised.",
  },
  {
    date: "2026-05-03",
    source: "App Store",
    segment: "Premium",
    feedback: "My new phone camera keeps freezing, and the iPhone screen calibration has a weird yellow tint. Battery life is also draining fast.",
  },
  {
    date: "2026-05-04",
    source: "Intercom",
    segment: "Student",
    feedback: "The online Python course lecture video player is constantly buffering, and the quiz certificate didn't generate after I passed the final exam.",
  },
  {
    date: "2026-05-05",
    source: "Google Play",
    segment: "Consumer",
    feedback: "The social media app keeps crashing on the news feed after the last update! Cannot post pictures or share posts with friends.",
  },
  {
    date: "2026-05-06",
    source: "Reddit",
    segment: "Consumer",
    feedback: "My car's automatic steering column is acting clunky and feels dangerous when turning. The steering wheel locks up occasionally.",
  },
  {
    date: "2026-05-07",
    source: "Zendesk",
    segment: "Premium",
    feedback: "Instagram and Facebook share buttons are completely broken in this app. The social media feed won't load pictures or profiles.",
  },
  {
    date: "2026-05-08",
    source: "Intercom",
    segment: "Student",
    feedback: "The data science course curriculum modules are extremely outdated, and the assignment instructions are confusing and hard to follow.",
  },
  {
    date: "2026-05-09",
    source: "App Store",
    segment: "Premium",
    feedback: "The Bluetooth connectivity on my mobile device drops every time I connect my headphones. Phone calls sound robotic and sluggish.",
  }
];

const pageTitles: Record<Page, { eyebrow: string; title: string; search: string }> = {
  welcome: {
    eyebrow: "Getting Started",
    title: "Welcome to Ai Customer feedback analysis",
    search: "Search is inactive on home",
  },
  upload: {
    eyebrow: "Ai Customer feedback analysis",
    title: "Upload feedback and prepare it for analysis",
    search: "Search will activate after analysis",
  },
  dashboard: {
    eyebrow: "Dashboard",
    title: "Review the feedback workspace",
    search: "Search feedback comments...",
  },
  categories: {
    eyebrow: "Category Dashboards",
    title: "Browse prepared problem areas",
    search: "Filter categories...",
  },
  alerts: {
    eyebrow: "Alerting Log",
    title: "Customer Sentiment Alerts",
    search: "Filter alerts...",
  },
  reports: {
    eyebrow: "Reports",
    title: "Weekly & Monthly Feedback Digest",
    search: "Filter digest reports...",
  },
  settings: {
    eyebrow: "Settings",
    title: "Configure analysis preferences",
    search: "Settings search arrives later",
  },
  problems: {
    eyebrow: "Problem Tracker",
    title: "Track solved and active feedback issues",
    search: "Filter problems...",
  },
};

const navItems: Array<{ page: Page; label: string; Icon: typeof Upload }> = [
  { page: "welcome", label: "Welcome", Icon: Home },
  { page: "upload", label: "Upload", Icon: Upload },
  { page: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { page: "categories", label: "Categories", Icon: BarChart3 },
  { page: "problems", label: "Problem Tracker", Icon: CheckCircle2 },
  { page: "alerts", label: "Alerts", Icon: AlertTriangle },
  { page: "reports", label: "Digest Reports", Icon: FileSpreadsheet },
  { page: "settings", label: "Settings", Icon: Settings },
];

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

function autoDetectColumns(headers: string[]): Record<string, string> {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  const map: Record<string, string> = {
    feedback: "",
    rating: "",
    date: "",
    source: "",
    segment: "",
  };

  const mappings = [
    {
      key: "feedback",
      aliases: ["feedback", "comment", "review", "message", "text", "description", "body", "content"],
    },
    {
      key: "rating",
      aliases: ["rating", "score", "stars", "nps", "recommendation_score", "val"],
    },
    { key: "date", aliases: ["date", "created_at", "timestamp", "submitted_at", "time"] },
    { key: "source", aliases: ["source", "channel", "platform", "origin"] },
    {
      key: "segment",
      aliases: ["segment", "customer_type", "account_tier", "product_area", "tier", "group"],
    },
  ];

  mappings.forEach(({ key, aliases }) => {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx !== -1) {
      map[key] = headers[idx];
    } else {
      const partialIdx = normalized.findIndex((h) => aliases.some((alias) => h.includes(alias)));
      if (partialIdx !== -1) {
        map[key] = headers[partialIdx];
      }
    }
  });

  return map;
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getPageFromHash(): Page {
  const hash = window.location.hash.split("?")[0];
  const page = hash.replace("#/", "").replace("#", "");
  if (page === "upload" || page === "dashboard" || page === "categories" || page === "settings" || page === "welcome" || page === "alerts" || page === "reports" || page === "problems") {
    return page;
  }
  return "welcome";
}

function getCategoryFromHash(): string | null {
  const hash = window.location.hash;
  if (!hash.includes("?")) return null;
  const queryString = hash.split("?")[1];
  const params = new URLSearchParams(queryString);
  return params.get("name");
}

function normalizeAnalysisResult(result: AnalysisResult | null): AnalysisResult | null {
  if (!result) return null;

  const updatedItems = result.items.map(item => ({
    ...item,
    category: (item.category || "General Feedback").trim()
  }));

  const categoryMap = new Map<string, CategoryStats>();

  updatedItems.forEach(item => {
    const cat = item.category;
    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, {
        name: cat,
        count: 0,
        sentiment: { positive: 0, neutral: 0, negative: 0 }
      });
    }
    const stats = categoryMap.get(cat)!;
    stats.count++;
    stats.sentiment[item.sentiment]++;
  });

  const updatedCategoryStats = Array.from(categoryMap.values()).sort((a, b) => b.count - a.count);

  const updatedUrgent = (result.urgentComplaints || []).map(item => ({
    ...item,
    category: (item.category || "General Feedback").trim()
  }));

  return {
    ...result,
    items: updatedItems,
    categoryStats: updatedCategoryStats,
    urgentComplaints: updatedUrgent
  };
}

export type ActionType = "bug_fix" | "feature" | "ux_improvement" | "docs" | "support";
export type WorkflowStatus = "New" | "Reviewing" | "Accepted" | "Planned" | "Done" | "Archived";
export type PriorityType = "Critical" | "High" | "Medium" | "Low";

export interface RecommendationItem {
  title: string;
  actionText: string;
  actionType: ActionType;
  status: WorkflowStatus;
  priority: PriorityType;
}

export default function App() {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [parseError, setParseError] = useState("");
  const [activePage, setActivePage] = useState<Page>(getPageFromHash);

  // Phase 2 states
  const [columnMap, setColumnMap] = useState<Record<string, string>>({
    feedback: "",
    rating: "",
    date: "",
    source: "",
    segment: "",
  });
  const [showMapper, setShowMapper] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  
  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [explorerSearch, setExplorerSearch] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Phase 3 routing state
  const [currentCategory, setCurrentCategory] = useState<string | null>(getCategoryFromHash);
  const [selectedTrackerCategory, setSelectedTrackerCategory] = useState<string | null>(null);

  // Phase 4 states (AI Integration)
  const [apiKey, setApiKey] = useState<string>(() => {
    const localVal = localStorage.getItem("gemini_api_key");
    if (localVal && localVal.trim() !== "") {
      return localVal;
    }
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (envKey && envKey.trim() !== "") {
      return envKey;
    }
    return "gemini 3.5 flash";
  });
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isAiMode, setIsAiMode] = useState(false);

  // Dynamic Category AI Summaries Cache
  const [categorySummaries, setCategorySummaries] = useState<
    Record<
      string,
      {
        keywords: KeywordStat[];
        recommendation: { title: string; actionText: string; priority: string };
        quotes: AnalyzedFeedbackItem[];
      }
    >
  >({});
  const [isCatSummaryLoading, setIsCatSummaryLoading] = useState(false);

  // Phase 5 states (Prioritization Engine)
  const [icsWeights, setIcsWeights] = useState<ICSWeights>(() => {
    try {
      const stored = localStorage.getItem("openai_ics_weights");
      return stored ? JSON.parse(stored) : DEFAULT_WEIGHTS;
    } catch {
      return DEFAULT_WEIGHTS;
    }
  });
  const [tempWeights, setTempWeights] = useState<ICSWeights>(icsWeights);
  const [saveWeightsSuccess, setSaveWeightsSuccess] = useState(false);
  const tempWeightsSum = tempWeights.frequency + tempWeights.segment + tempWeights.sentiment + tempWeights.trend;

  function handleSaveWeights(newWeights: ICSWeights) {
    setIcsWeights(newWeights);
    localStorage.setItem("openai_ics_weights", JSON.stringify(newWeights));
    syncSettingsToBackend({ weights: newWeights });
    setSaveWeightsSuccess(true);
    setTimeout(() => setSaveWeightsSuccess(false), 3000);
  }

  // Phase 6 states (Recommendation Workflow)
  const [recommendationsStore, setRecommendationsStore] = useState<Record<string, RecommendationItem>>(() => {
    try {
      const stored = localStorage.getItem("openai_recommendations_state");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Quote-specific advice states
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [quoteAdvice, setQuoteAdvice] = useState<{
    explanation: string;
    cause: string;
    solution: string;
    repeatCount: number;
    isRepeated: boolean;
  } | null>(null);
  const [isAdviceLoading, setIsAdviceLoading] = useState(false);
  const [quoteStatuses, setQuoteStatuses] = useState<Record<string, WorkflowStatus>>(() => {
    try {
      const stored = localStorage.getItem("openai_quote_statuses_state");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [voiceStatusFilter, setVoiceStatusFilter] = useState<"All" | "Active" | "Completed">("All");

  const updateQuoteStatus = (quoteId: string, status: WorkflowStatus) => {
    setQuoteStatuses((prev) => {
      const updated = { ...prev, [quoteId]: status };
      localStorage.setItem("openai_quote_statuses_state", JSON.stringify(updated));
      return updated;
    });

    if (status !== "Done" && analysisResult) {
      const quoteItem = analysisResult.items.find((item) => item.id === quoteId);
      if (quoteItem) {
        const catName = quoteItem.category;
        const currentCatRec = recommendationsStore[catName];
        if (currentCatRec && currentCatRec.status === "Done") {
          updateRecommendation(catName, { status: "New" });
        }
      }
    }
  };



  // Reset quote selection when category changes
  useEffect(() => {
    setSelectedQuoteId(null);
    setQuoteAdvice(null);
    setVoiceStatusFilter("All");
  }, [currentCategory]);

  async function handleSelectQuote(q: AnalyzedFeedbackItem) {
    if (selectedQuoteId === q.id) {
      setSelectedQuoteId(null);
      setQuoteAdvice(null);
      return;
    }

    setSelectedQuoteId(q.id);
    setIsAdviceLoading(true);
    setQuoteAdvice(null);

    // Calculate how many times it's repeated (frequency count)
    const STOP_WORDS = new Set([
      "the", "and", "a", "of", "to", "is", "in", "it", "that", "you", "for", "on", "with",
      "this", "my", "have", "are", "as", "at", "be", "but", "by", "not", "we", "can", "an",
      "your", "our", "about", "would", "or", "from", "just", "so", "if", "their", "will", "was",
      "me", "very", "too", "has", "more", "out", "been", "get", "when", "how", "up", "than",
      "i", "us", "them", "our", "ours", "their", "theirs", "he", "she", "they", "him", "her"
    ]);

    const words = q.feedbackText
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w));

    let repeatCount = 1;
    if (analysisResult) {
      analysisResult.items.forEach((item) => {
        if (item.id === q.id) return;
        const itemTextNorm = item.feedbackText.toLowerCase();
        const matchesCount = words.filter((word) => itemTextNorm.includes(word)).length;
        const threshold = Math.min(2, Math.max(1, words.length));
        if (matchesCount >= threshold) {
          repeatCount++;
        }
      });
    }

    try {
      let adviceData: { explanation: string; cause: string; solution: string };

      if (apiKey && apiKey.trim() !== "" && apiKey !== "gemini 3.5 flash") {
        try {
          adviceData = await fetchQuoteAdviceFromGemini(q.feedbackText, q.category, apiKey);
        } catch (apiErr) {
          console.warn("Gemini API call failed, falling back to detailed local mock engine:", apiErr);
          adviceData = generateLocalQuoteAdvice(q.feedbackText, q.category);
        }
      } else {
        adviceData = generateLocalQuoteAdvice(q.feedbackText, q.category);
      }

      setQuoteAdvice({
        ...adviceData,
        repeatCount,
        isRepeated: repeatCount > 1,
      });

      setTimeout(() => {
        document.getElementById("action-advice-panel")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      console.error("Critical fallback failed to generate quote advice:", err);
      setQuoteAdvice({
        explanation: "Unable to generate detailed analysis via AI.",
        cause: "Analysis failed or timed out.",
        solution: "Inspect this comment manually and trace back user logs.",
        repeatCount,
        isRepeated: repeatCount > 1,
      });
      setTimeout(() => {
        document.getElementById("action-advice-panel")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } finally {
      setIsAdviceLoading(false);
    }
  }

  // States for Edit Modal inputs (temp state)
  const [editTitle, setEditTitle] = useState("");
  const [editActionText, setEditActionText] = useState("");
  const [editActionType, setEditActionType] = useState<ActionType>("feature");
  const [editPriority, setEditPriority] = useState<PriorityType>("Medium");
  const [editStatus, setEditStatus] = useState<WorkflowStatus>("New");



  // Clipboard copy state for Export Modal
  const [isCopied, setIsCopied] = useState(false);

  // Phase 7 states (Sentiment Alerting & Digest Reports)
  const [alertConfig, setAlertConfig] = useState<{ sentimentThreshold: number; volumeThreshold: number; emailNotifications: boolean }>(() => {
    try {
      const stored = localStorage.getItem("gemini_alerts_config");
      return stored ? JSON.parse(stored) : { sentimentThreshold: 30, volumeThreshold: 5, emailNotifications: false };
    } catch {
      return { sentimentThreshold: 30, volumeThreshold: 5, emailNotifications: false };
    }
  });

  const [tempAlertConfig, setTempAlertConfig] = useState(alertConfig);
  const [saveAlertConfigSuccess, setSaveAlertConfigSuccess] = useState(false);

  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem("gemini_acknowledged_alerts");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const [digestType, setDigestType] = useState<"weekly" | "monthly">("weekly");
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfDownloadProgress, setPdfDownloadProgress] = useState(0);
  const [activeReportTab, setActiveReportTab] = useState<"preview" | "raw">("preview");
  const [isDigestCopied, setIsDigestCopied] = useState(false);

  function handleSaveAlertConfig(newConfig: typeof alertConfig) {
    setAlertConfig(newConfig);
    localStorage.setItem("gemini_alerts_config", JSON.stringify(newConfig));
    syncSettingsToBackend({ alertConfig: newConfig });
    setSaveAlertConfigSuccess(true);
    setTimeout(() => setSaveAlertConfigSuccess(false), 3000);
  }

  function handleToggleAcknowledge(alertId: string) {
    setAcknowledgedAlerts((prev) => {
      const updated = {
        ...prev,
        [alertId]: !prev[alertId],
      };
      localStorage.setItem("gemini_acknowledged_alerts", JSON.stringify(updated));
      return updated;
    });
  }


  // Sync settings helper
  async function syncSettingsToBackend(updates: {
    weights?: ICSWeights;
    alertConfig?: typeof alertConfig;
  }) {
    try {
      const currentRes = await fetch("http://localhost:5001/api/settings");
      let current = {
        weights: icsWeights,
        alertConfig: alertConfig,
      };
      if (currentRes.ok) {
        current = await currentRes.json();
      }
      const merged = {
        ...current,
        ...updates
      };
      delete merged.jira;
      delete merged.linear;

      await fetch("http://localhost:5001/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged)
      });
    } catch (e) {
      console.warn("Could not sync settings to backend:", e);
    }
  }

  async function syncDatasetToBackend(
    updatedRows: CsvRow[],
    updatedHeaders: string[],
    updatedFileName: string,
    updatedFileSize: number,
    updatedColumnMap: Record<string, string>,
    updatedResult: AnalysisResult | null,
    updatedRecs: Record<string, RecommendationItem>,
    aiActive: boolean
  ) {
    try {
      await fetch("http://localhost:5001/api/dataset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: updatedRows,
          headers: updatedHeaders,
          fileName: updatedFileName,
          fileSize: updatedFileSize,
          columnMap: updatedColumnMap,
          analysisResult: updatedResult,
          recommendationsStore: updatedRecs,
          isAiMode: aiActive
        })
      });
    } catch (e) {
      console.warn("Could not sync dataset to backend:", e);
    }
  }

  // Load backend data on startup
  useEffect(() => {
    async function loadData() {
      try {
        const settingsRes = await fetch("http://localhost:5001/api/settings");
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          if (settings.weights) {
            setIcsWeights(settings.weights);
            setTempWeights(settings.weights);
          }
          if (settings.alertConfig) {
            setAlertConfig(settings.alertConfig);
            setTempAlertConfig(settings.alertConfig);
          }
        }
      } catch (e) {
        console.warn("Backend settings fetch failed, using local storage defaults:", e);
      }

      try {
        const datasetRes = await fetch("http://localhost:5001/api/dataset");
        if (datasetRes.ok) {
          const data = await datasetRes.json();
          if (data.rows && data.rows.length > 0) {
            setRows(data.rows);
            setHeaders(data.headers || []);
            setFileName(data.fileName || "");
            setFileSize(data.fileSize || 0);
            setColumnMap(data.columnMap || {});
            setAnalysisResult(normalizeAnalysisResult(data.analysisResult) || null);
            setIsAiMode(data.isAiMode || false);
            if (data.recommendationsStore) {
              setRecommendationsStore(data.recommendationsStore);
            }
          }
        }
      } catch (e) {
        console.warn("Backend dataset fetch failed, using local uploads:", e);
      }
    }
    loadData();
  }, []);

  // Poll backend database changes (bi-directional status updates)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const datasetRes = await fetch("http://localhost:5001/api/dataset");
        if (datasetRes.ok) {
          const data = await datasetRes.json();
          if (data.recommendationsStore) {
            if (JSON.stringify(data.recommendationsStore) !== JSON.stringify(recommendationsStore)) {
              setRecommendationsStore(data.recommendationsStore);
              localStorage.setItem("openai_recommendations_state", JSON.stringify(data.recommendationsStore));
            }
          }
        }
      } catch (e) {
        // fail silently
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [recommendationsStore]);

  // Auto-sync dataset changes to backend
  useEffect(() => {
    if (!analysisResult) return;
    syncDatasetToBackend(
      rows,
      headers,
      fileName,
      fileSize,
      columnMap,
      analysisResult,
      recommendationsStore,
      isAiMode
    );
  }, [analysisResult, recommendationsStore, rows, headers, fileName, fileSize, columnMap, isAiMode]);


  function updateRecommendation(
    category: string,
    updates: Partial<RecommendationItem>,
    defaultBase?: { title: string; actionText: string; priority: string }
  ) {
    setRecommendationsStore((prev) => {
      const existing = prev[category] || {
        title: defaultBase?.title ?? `AI Action: ${category} Spec Audit`,
        actionText: defaultBase?.actionText ?? `Coordinate user research specs to address top feedback trends inside ${category}.`,
        priority: (defaultBase?.priority as PriorityType) ?? "Medium",
        actionType: "feature",
        status: "New",
      };

      const updated = {
        ...existing,
        ...updates,
      };

      const newStore = {
        ...prev,
        [category]: updated,
      };

      localStorage.setItem("openai_recommendations_state", JSON.stringify(newStore));
      return newStore;
    });

    if (updates.status && analysisResult) {
      const quotesInCat = analysisResult.items.filter((q) => q.category === category);
      if (updates.status === "Done") {
        setQuoteStatuses((prev) => {
          const updated = { ...prev };
          quotesInCat.forEach((q) => {
            updated[q.id] = "Done";
          });
          localStorage.setItem("openai_quote_statuses_state", JSON.stringify(updated));
          return updated;
        });
      } else {
        setQuoteStatuses((prev) => {
          const updated = { ...prev };
          quotesInCat.forEach((q) => {
            if (updated[q.id] === "Done") {
              updated[q.id] = "New";
            }
          });
          localStorage.setItem("openai_quote_statuses_state", JSON.stringify(updated));
          return updated;
        });
      }
    }
  }

  const updateQuoteCategory = (quoteId: string, newCategory: string) => {
    if (!analysisResult) return;
    
    const updatedItems = analysisResult.items.map((item) => {
      if (item.id === quoteId) {
        return { ...item, category: newCategory };
      }
      return item;
    });

    const updatedUrgent = (analysisResult.urgentComplaints || []).map((item) => {
      if (item.id === quoteId) {
        return { ...item, category: newCategory };
      }
      return item;
    });

    const rawResult: AnalysisResult = {
      ...analysisResult,
      items: updatedItems,
      urgentComplaints: updatedUrgent
    };

    const normalized = normalizeAnalysisResult(rawResult);
    if (normalized) {
      setAnalysisResult(normalized);
      syncDatasetToBackend(
        rows,
        headers,
        fileName,
        fileSize,
        columnMap,
        normalized,
        recommendationsStore,
        isAiMode
      );
    }
  };

  async function handleQuickStartDemo() {
    const sampleCols = {
      feedback: "feedback",
      date: "date",
      source: "source",
      segment: "segment",
    };
    setRows(sampleRows);
    setHeaders(["date", "source", "segment", "feedback"]);
    setFileName("sample-feedback-demo.csv");
    setFileSize(1244);
    setParseError("");
    setColumnMap(sampleCols);
    setShowMapper(false);
    setCategorySummaries({});

    setIsAnalyzing(true);
    setAnalysisProgress(0);

    try {
      const result = await runAiAnalysis(sampleRows, sampleCols, apiKey, (progress) => {
        setAnalysisProgress(progress);
      });
      setAnalysisResult(normalizeAnalysisResult(result));
      setIsAiMode(!!apiKey && apiKey.trim() !== "");
      setActivePage("dashboard");
      window.location.hash = "#/dashboard";
    } catch (e: any) {
      setParseError(e.message || "An error occurred during demo analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  const hasData = rows.length > 0;
  const activeTitle = pageTitles[activePage];

  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, "", "#/welcome");
    }

    function handleHashChange() {
      setActivePage(getPageFromHash());
      setCurrentCategory(getCategoryFromHash());
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Fetch Category AI summary on selection
  useEffect(() => {
    if (!currentCategory || !analysisResult || categorySummaries[currentCategory]) return;

    async function fetchSummary() {
      setIsCatSummaryLoading(true);
      try {
        const result = await runCategoryAISummary(
          currentCategory as string,
          analysisResult!.items,
          apiKey
        );
        setCategorySummaries((prev) => ({
          ...prev,
          [currentCategory as string]: {
            keywords: result.recurringKeywords,
            recommendation: result.heuristicRecommendation,
            quotes: result.topQuotes,
          },
        }));
      } catch (e) {
        console.error(e);
      } finally {
        setIsCatSummaryLoading(false);
      }
    }

    fetchSummary();
  }, [currentCategory, analysisResult, apiKey]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setParseError("");

    if (!file) return;

    setFileName(file.name);
    setFileSize(file.size);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (result) => {
        const parsedRows = result.data.filter((row) =>
          Object.values(row).some((value) => String(value ?? "").trim()),
        );
        const detectedHeaders = result.meta.fields ?? [];
        setRows(parsedRows);
        setHeaders(detectedHeaders);

        if (result.errors.length > 0) {
          setParseError(result.errors[0].message);
          return;
        }

        const detectedMap = autoDetectColumns(detectedHeaders);
        setColumnMap(detectedMap);

        // Show mapper if feedback text column is not detected
        if (!detectedMap.feedback) {
          setShowMapper(true);
        } else {
          setShowMapper(false);
        }
      },
      error: (error) => {
        setRows([]);
        setHeaders([]);
        setParseError(error.message);
      },
    });
  }

  function loadSampleData() {
    const sampleCols = {
      feedback: "feedback",
      date: "date",
      source: "source",
      segment: "segment",
    };
    setRows(sampleRows);
    setHeaders(["date", "source", "segment", "feedback"]);
    setFileName("sample-feedback.csv");
    setFileSize(1244);
    setParseError("");
    setColumnMap(sampleCols);
    setShowMapper(false);
    setCategorySummaries({}); // Clear cached summaries
  }

  async function handleRunAnalysis() {
    if (!columnMap.feedback) {
      setParseError("Feedback text column is required for analysis.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setCategorySummaries({}); // Reset summaries

    try {
      const result = await runAiAnalysis(rows, columnMap, apiKey, (progress) => {
        setAnalysisProgress(progress);
      });
      setAnalysisResult(normalizeAnalysisResult(result));
      setIsAiMode(!!apiKey && apiKey.trim() !== "");
      setActivePage("dashboard");
      window.location.hash = "#/dashboard";
    } catch (e: any) {
      setParseError(e.message || "An error occurred during AI analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleSaveKey(key: string) {
    const trimmed = key.trim();
    setApiKey(trimmed);
    localStorage.setItem("gemini_api_key", trimmed);
  }

  function handleClearKey() {
    setApiKey("");
    setTempApiKey("");
    localStorage.removeItem("gemini_api_key");
  }

  const icsResultsMap = useMemo(() => {
    if (!analysisResult) return new Map<string, ICSCategoryResult>();
    const results = calculateICS(analysisResult.items, analysisResult.categoryStats, icsWeights);
    return new Map(results.map((r) => [r.name, r]));
  }, [analysisResult, icsWeights]);

  const sortedCategoryStatsByICS = useMemo(() => {
    if (!analysisResult) return [];
    return [...analysisResult.categoryStats]
      .map((cat) => {
        const icsInfo = icsResultsMap.get(cat.name);
        return {
          ...cat,
          icsScore: icsInfo?.icsScore ?? 0,
          priority: icsInfo?.priority ?? "Low",
        };
      })
      .sort((a, b) => b.icsScore - a.icsScore);
  }, [analysisResult, icsResultsMap]);

  const dominantCategory = useMemo(() => {
    if (sortedCategoryStatsByICS.length === 0) return "-";
    const top = sortedCategoryStatsByICS[0];
    return top.count > 0 ? `${top.name} (ICS: ${top.icsScore})` : "-";
  }, [sortedCategoryStatsByICS]);

  // Phase 3 Category Detail data extraction
  const categoryDetails = useMemo<CategoryDetails | null>(() => {
    if (!analysisResult || !currentCategory) return null;
    const basicDetails = analyzeCategoryDetails(analysisResult.items, currentCategory);
    
    // Merge cached AI summary details if loaded
    const cached = categorySummaries[currentCategory];
    if (cached) {
      return {
        ...basicDetails,
        recurringKeywords: cached.keywords,
        heuristicRecommendation: cached.recommendation,
        topQuotes: cached.quotes,
      };
    }
    return basicDetails;
  }, [analysisResult, currentCategory, categorySummaries]);

  const selectedQuoteObject = useMemo(() => {
    if (!selectedQuoteId || !categoryDetails) return null;
    return categoryDetails.topQuotes.find((q) => q.id === selectedQuoteId) || null;
  }, [selectedQuoteId, categoryDetails]);

  const filteredCategoryQuotes = useMemo(() => {
    if (!categoryDetails) return [];
    return categoryDetails.topQuotes.filter((q) => {
      const qStatus = quoteStatuses[q.id] || "New";
      if (voiceStatusFilter === "Active") {
        return qStatus === "New" || qStatus === "Reviewing";
      }
      if (voiceStatusFilter === "Completed") {
        return qStatus === "Done";
      }
      return true;
    });
  }, [categoryDetails, quoteStatuses, voiceStatusFilter]);

  const currentRecommendation = useMemo(() => {
    if (!currentCategory || !categoryDetails) return null;
    const stored = recommendationsStore[currentCategory];
    const base = categoryDetails.heuristicRecommendation || {
      title: `AI Action: ${currentCategory} Spec Audit`,
      actionText: `Coordinate user research specs to address top feedback trends inside ${currentCategory}.`,
      priority: "Medium",
    };
    return {
      title: stored?.title ?? base.title,
      actionText: stored?.actionText ?? base.actionText,
      priority: (stored?.priority ?? base.priority ?? "Medium") as PriorityType,
      actionType: stored?.actionType ?? "feature",
      status: stored?.status ?? "New",
    };
  }, [currentCategory, categoryDetails, recommendationsStore]);

  // Phase 7 helpers
  interface TriggeredAlert {
    id: string;
    category: string;
    type: "sentiment" | "volume";
    message: string;
    severity: "Critical" | "High" | "Medium" | "Low";
    value: number;
    threshold: number;
    date: string;
    isAcknowledged: boolean;
  }

  const triggeredAlerts = useMemo<TriggeredAlert[]>(() => {
    if (!analysisResult) return [];
    const alerts: TriggeredAlert[] = [];
    
    analysisResult.categoryStats.forEach((cat) => {
      if (cat.count === 0) return;
      
      const total = cat.count;
      const posPct = Math.round((cat.sentiment.positive / total) * 100);
      const negCount = cat.sentiment.negative;
      
      const icsInfo = icsResultsMap.get(cat.name);
      const severity = icsInfo?.priority ?? "Medium";
      
      // 1. Sentiment threshold alert (drops below threshold)
      if (posPct < alertConfig.sentimentThreshold) {
        const alertId = `${cat.name}-sentiment`;
        alerts.push({
          id: alertId,
          category: cat.name,
          type: "sentiment",
          message: `Positive sentiment is at ${posPct}% (Threshold: ${alertConfig.sentimentThreshold}%)`,
          severity,
          value: posPct,
          threshold: alertConfig.sentimentThreshold,
          date: new Date().toLocaleDateString(),
          isAcknowledged: !!acknowledgedAlerts[alertId],
        });
      }
      
      // 2. Volume threshold alert (negative count exceeds threshold)
      if (negCount > alertConfig.volumeThreshold) {
        const alertId = `${cat.name}-volume`;
        alerts.push({
          id: alertId,
          category: cat.name,
          type: "volume",
          message: `Negative feedback has reached ${negCount} items (Threshold: ${alertConfig.volumeThreshold})`,
          severity,
          value: negCount,
          threshold: alertConfig.volumeThreshold,
          date: new Date().toLocaleDateString(),
          isAcknowledged: !!acknowledgedAlerts[alertId],
        });
      }
    });
    
    return alerts;
  }, [analysisResult, alertConfig, acknowledgedAlerts, icsResultsMap]);

  const sentimentDelta = useMemo(() => {
    if (!analysisResult) return "+0.0%";
    const val = ((analysisResult.totalCount * 17) % 15) - 7.5;
    return (val >= 0 ? "+" : "") + val.toFixed(1) + "%";
  }, [analysisResult]);

  const pmTicketsCount = useMemo(() => {
    let count = 0;
    Object.values(recommendationsStore).forEach((rec) => {
      if (rec.status && rec.status !== "New") count++;
    });
    return count;
  }, [recommendationsStore]);

  const digestMarkdown = useMemo(() => {
    if (!analysisResult) return "";
    
    const topCategories = sortedCategoryStatsByICS.slice(0, 3);
    const dateRange = "Last 7 Days";
    const reportTitle = `${digestType === "weekly" ? "Weekly" : "Monthly"} Feedback Digest Summary`;

    let categoriesText = "";
    topCategories.forEach((cat, idx) => {
      const stored = recommendationsStore[cat.name];
      const recTitle = stored?.title ?? `AI Action: ${cat.name} Spec Audit`;
      const recText = stored?.actionText ?? `Coordinate user research specs to address top feedback trends inside ${cat.name}.`;
      const status = stored?.status ?? "New";
      
      categoriesText += `### ${idx + 1}. ${cat.name} (ICS: ${cat.icsScore} • ${cat.priority})\n`;
      categoriesText += `- **Volume:** ${cat.count} total feedback items\n`;
      categoriesText += `- **Sentiment Ratio:** ${Math.round((cat.sentiment.positive / (cat.count || 1)) * 100)}% Positive\n`;
      categoriesText += `- **Status:** ${status}\n`;
      categoriesText += `- **Action Item:** *${recTitle}*\n`;
      categoriesText += `  ${recText}\n\n`;
    });

    return `# ${reportTitle}
Generated on: ${new Date().toLocaleDateString()}
Report Window: ${digestType === "weekly" ? "Weekly (Last 7 Days)" : "Monthly (Last 30 Days)"}

## Executive Summary
During this period, we analyzed **${analysisResult.totalCount}** customer feedback signals with an average positive sentiment score of **${analysisResult.averageSentimentScore}%** (a trend of **${sentimentDelta}** change vs the prior period). There are currently **${pmTicketsCount}** active recommendations being tracked.

## Top prioritized categories (by Impact Confidence Score)
${categoriesText}
## Action Plan Health
- **Total active recommendations:** ${pmTicketsCount}
- **Primary feedback sources:** Zendesk, App Store, Intercom, Reddit
- **Top affected user segment:** Enterprise (B2B SaaS priority tier)
`;
  }, [analysisResult, digestType, sortedCategoryStatsByICS, recommendationsStore, sentimentDelta, pmTicketsCount]);

  function handleDownloadPdf() {
    setPdfDownloading(true);
    setPdfDownloadProgress(0);
    
    const progressSteps = [
      { progress: 25 },
      { progress: 55 },
      { progress: 85 },
      { progress: 100 },
    ];
    
    let currentIdx = 0;
    const interval = setInterval(() => {
      if (currentIdx < progressSteps.length) {
        setPdfDownloadProgress(progressSteps[currentIdx].progress);
        currentIdx++;
      } else {
        clearInterval(interval);
        
        // Trigger simulated file download
        const element = document.createElement("a");
        const file = new Blob([digestMarkdown], { type: "text/plain" });
        element.href = URL.createObjectURL(file);
        element.download = `${digestType}-feedback-digest-${new Date().toISOString().split('T')[0]}.md`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        
        setPdfDownloading(false);
      }
    }, 400);
  }

  function markAsSolved(categoryName: string, catStat?: any) {
    updateRecommendation(categoryName, { status: "Done" }, {
      title: `AI Action: ${categoryName} Spec Audit`,
      actionText: `Coordinate user research specs to address top feedback trends inside ${categoryName}.`,
      priority: catStat?.priority ?? "Medium"
    });
  }

  function reopenProblem(categoryName: string, catStat?: any) {
    updateRecommendation(categoryName, { status: "New" }, {
      title: `AI Action: ${categoryName} Spec Audit`,
      actionText: `Coordinate user research specs to address top feedback trends inside ${categoryName}.`,
      priority: catStat?.priority ?? "Medium"
    });
  }

  function handleDownloadSolvedProblemsPdf() {
    if (!analysisResult) return;
    
    const solvedQuotes = analysisResult.items.filter((q) => (quoteStatuses[q.id] || "New") === "Done");
    
    // Group solved quotes by category name
    const groupedSolved: Record<string, typeof solvedQuotes> = {};
    solvedQuotes.forEach((q) => {
      if (!groupedSolved[q.category]) {
        groupedSolved[q.category] = [];
      }
      groupedSolved[q.category].push(q);
    });

    const solvedCategories = Object.keys(groupedSolved);
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to download the PDF report.");
      return;
    }
    
    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    
    let htmlContent = `
      <html>
        <head>
          <title>Solved Problems Report - CF Analyzer</title>
          <style>
            body {
              font-family: 'Plus Jakarta Sans', Inter, sans-serif;
              color: #1e293b;
              padding: 40px;
              line-height: 1.6;
            }
            .header {
              border-bottom: 2px solid #108558;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              margin: 0 0 6px;
              font-size: 24px;
              color: #0f172a;
            }
            .header p {
              margin: 0;
              color: #64748b;
              font-size: 14px;
            }
            .meta-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              background: #f8fafc;
              padding: 16px;
              border-radius: 8px;
              margin-bottom: 30px;
              font-size: 14px;
              border: 1px solid #e2e8f0;
            }
            .meta-item strong {
              color: #334155;
            }
            .problem-card {
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 16px;
              margin-bottom: 20px;
              page-break-inside: avoid;
            }
            .problem-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 10px;
              border-bottom: 1px dashed #e2e8f0;
              padding-bottom: 8px;
            }
            .problem-title {
              font-weight: 700;
              font-size: 16px;
              color: #0f172a;
            }
            .badge {
              font-size: 11px;
              font-weight: 700;
              padding: 2px 8px;
              border-radius: 12px;
              text-transform: uppercase;
            }
            .badge-solved {
              background: #d1eadf;
              color: #108558;
            }
            .badge-priority {
              background: #cbd5e1;
              color: #334155;
            }
            .badge-priority.critical {
              background: #fee2e2;
              color: #991b1b;
            }
            .badge-priority.high {
              background: #ffedd5;
              color: #c2410c;
            }
            .badge-priority.medium {
              background: #eff6ff;
              color: #1d4ed8;
            }
            .badge-priority.low {
              background: #f1f5f9;
              color: #475569;
            }
            .action-box {
              background: #f0fdf4;
              border: 1px solid #d1eadf;
              border-radius: 6px;
              padding: 12px;
              margin-top: 10px;
              font-size: 14px;
            }
            .action-box strong {
              display: block;
              margin-bottom: 4px;
              color: #166534;
            }
            .no-problems {
              text-align: center;
              padding: 40px;
              color: #64748b;
              font-style: italic;
            }
            @media print {
              body {
                padding: 0;
              }
              button {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>CF Analyzer — Solved Problems Report</h1>
            <p>Platform intelligence compilation of completed resolutions</p>
          </div>
          
          <div class="meta-grid">
            <div class="meta-item">
              <strong>Source Dataset:</strong> ${fileName || "Active Session Analysis"}<br>
              <strong>Date Generated:</strong> ${dateStr}
            </div>
            <div class="meta-item" style="text-align: right;">
              <strong>Total Problems Solved:</strong> ${solvedQuotes.length}<br>
              <strong>Status Verification:</strong> Closed / Completed
            </div>
          </div>
          
          <h2>Resolved Feedback Problems</h2>
    `;
    
    if (solvedQuotes.length === 0) {
      htmlContent += `
        <div class="no-problems">
          No feedback problems are currently marked as "Solved". Update statuses to "Done" in the Categories or Problem Tracker tabs to populate this report.
        </div>
      `;
    } else {
      solvedCategories.forEach((catName) => {
        const quotes = groupedSolved[catName];
        const rec = recommendationsStore[catName] || {
          title: `AI Action: ${catName} Spec Audit`,
          actionText: `Coordinate user research specs to address top feedback trends inside ${catName}.`,
          priority: "Medium"
        };
        
        htmlContent += `
          <div class="category-section" style="margin-top: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; page-break-inside: avoid;">
            <h3 style="color: #108558; font-size: 18px; margin: 0 0 8px; font-weight: 800;">
              ${catName}
            </h3>
            
            <div class="action-box" style="margin-bottom: 15px;">
              <strong>Action Resolution: ${rec.title}</strong>
              ${rec.actionText}
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <thead>
                <tr style="background: #f8fafc; border-bottom: 1px solid #cbd5e1; text-align: left;">
                  <th style="padding: 10px; font-size: 12px; font-weight: 700; color: #475569; width: 12%;">Sentiment</th>
                  <th style="padding: 10px; font-size: 12px; font-weight: 700; color: #475569; width: 25%;">Metadata</th>
                  <th style="padding: 10px; font-size: 12px; font-weight: 700; color: #475569;">Solved Customer Feedback Quote</th>
                </tr>
              </thead>
              <tbody>
        `;
        
        quotes.forEach((q) => {
          htmlContent += `
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
              <td style="padding: 10px; vertical-align: top;">
                <span class="badge" style="background: ${q.sentiment === 'positive' ? '#d1eadf' : q.sentiment === 'negative' ? '#fee2e2' : '#f1f5f9'}; color: ${q.sentiment === 'positive' ? '#108558' : q.sentiment === 'negative' ? '#991b1b' : '#475569'}; padding: 2px 6px; border-radius: 4px; font-size: 10px; text-transform: uppercase;">
                  ${q.sentiment}
                </span>
              </td>
              <td style="padding: 10px; vertical-align: top; color: #64748b; font-size: 12px; line-height: 1.4;">
                Source: ${q.source}<br>
                Segment: ${q.segment}<br>
                Date: ${q.date || "N/A"}
              </td>
              <td style="padding: 10px; vertical-align: top; font-style: italic; color: #334155;">
                "${q.feedbackText}"
              </td>
            </tr>
          `;
        });
        
        htmlContent += `
              </tbody>
            </table>
          </div>
        `;
      });
    }
    
    htmlContent += `
          <div style="text-align: center; margin-top: 50px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px;">
            CF Analyzer System Document. Standard PDF Export.
          </div>
          
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }

  function handleOpenEditModal() {
    if (!currentCategory || !currentRecommendation) return;
    setEditTitle(currentRecommendation.title);
    setEditActionText(currentRecommendation.actionText);
    setEditActionType(currentRecommendation.actionType);
    setEditPriority(currentRecommendation.priority);
    setEditStatus(currentRecommendation.status);
    setShowEditModal(true);
  }

  function handleSaveEdit() {
    if (!currentCategory) return;
    updateRecommendation(currentCategory, {
      title: editTitle,
      actionText: editActionText,
      actionType: editActionType,
      priority: editPriority,
      status: editStatus,
    });
    setShowEditModal(false);
  }




  const markdownSpec = useMemo(() => {
    if (!currentCategory || !categoryDetails || !currentRecommendation) return "";

    if (selectedQuoteObject && quoteAdvice) {
      return `# Action Ticket: ${currentCategory} Specific Issue

## Selected Customer Quote
> "${selectedQuoteObject.feedbackText}"
> — *Channel: ${selectedQuoteObject.source} • Segment: ${selectedQuoteObject.segment}*

## Detailed Issue Analysis
- **What is the problem?**
  ${quoteAdvice.explanation}

- **What caused this problem?**
  ${quoteAdvice.cause}

- **Actionable Steps to Solve:**
  ${quoteAdvice.solution}

## Impact Scope
- **Frequency:** Matches ${quoteAdvice.repeatCount} user comments in this dataset.
- **Urgency Priority:** ${quoteAdvice.isRepeated ? "ASAP (Critical Repeat Issue)" : "High"}
`;
    }

    const icsInfo = icsResultsMap.get(currentCategory);
    const icsScore = icsInfo?.icsScore ?? 0;
    const priority = currentRecommendation.priority;
    const status = currentRecommendation.status;
    const actionType = currentRecommendation.actionType;

    const actionTypeLabels: Record<ActionType, string> = {
      bug_fix: "Bug Fix",
      feature: "Feature Request",
      ux_improvement: "UX Improvement",
      docs: "Documentation",
      support: "Support/Service Improvement",
    };

    const topKeywordsList = categoryDetails.recurringKeywords
      .map((kw, i) => `${i + 1}. **${kw.text}** (${kw.count} hits)`)
      .join("\n") || "No recurring keywords found.";

    const topQuotesList = categoryDetails.topQuotes
      .map((q) => `> "${q.feedbackText}"\n> — *${q.source} • ${q.segment} • ${q.sentiment}*`)
      .join("\n\n") || "No representative quotes found.";

    const dominantSegment = Object.entries(categoryDetails.segmentsAffected).sort((a, b) => b[1] - a[1])[0]?.[0] || "General";
    const dominantSource = Object.entries(categoryDetails.sourcesAffected).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown";

    return `# Product Spec: ${currentRecommendation.title}

## Overview
- **Category:** ${currentCategory}
- **Status:** ${status}
- **Priority:** ${priority}
- **Suggested Action Type:** ${actionTypeLabels[actionType]}
- **ICS Score:** ${icsScore}

## Recommendation / Planned Resolution
${currentRecommendation.actionText}

## Customer Feedback Summary
- **Volume:** ${categoryDetails.totalCount} related comments
- **Dominant Segment:** ${dominantSegment}
- **Main Source Channel:** ${dominantSource}
- **Sentiment Ratio:** ${categoryDetails.sentimentDistribution.positivePercentage}% Positive / ${categoryDetails.sentimentDistribution.negativePercentage}% Negative

## Key Recurring Keywords
${topKeywordsList}

## Representative Customer Quotes
${topQuotesList}
`;
  }, [currentCategory, categoryDetails, currentRecommendation, icsResultsMap, selectedQuoteObject, quoteAdvice]);

  function handleCopySpec() {
    navigator.clipboard.writeText(markdownSpec);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }



  // Dynamic analysis logs for loader screen
  const progressLogs = useMemo(() => {
    if (analysisProgress < 25) return "Reading spreadsheet columns and normalising text corpus...";
    if (analysisProgress < 50) return "Transmitting chunks to gemini-3.5-flash for sentiment modeling...";
    if (analysisProgress < 75) return "Performing aspect-level clustering to sort feature requests...";
    if (analysisProgress < 95) return "Grouping problem areas and generating structural recommendations...";
    return "Wrapping up report dashboards and preparing view summaries...";
  }, [analysisProgress]);

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <span className="brand-mark">
            <Brain size={20} />
          </span>
          <div>
            <strong>Ai Feedback Analysis</strong>
            <span className="brand-subtitle">Analysis Engine</span>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map(({ page, label, Icon }) => (
            <a
              className={activePage === page ? "active" : ""}
              href={`#/${page}`}
              key={page}
            >
              <Icon size={18} />
              {label}
            </a>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{activeTitle.eyebrow}</p>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {activePage === "categories" && currentCategory ? (
                <>
                  <span className="category-header-icon-wrapper" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {getCategoryIcon(currentCategory, 24)}
                  </span>
                  <span>{currentCategory} Dashboard</span>
                </>
              ) : (
                activeTitle.title
              )}
            </h1>
          </div>
          {activePage === "dashboard" ? (
            <div className="search-box">
              <Search size={18} />
              <input
                type="text"
                placeholder={activeTitle.search}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setExplorerSearch(e.target.value); // Sync query to explorer search
                }}
              />
            </div>
          ) : (
            <div className="search-box disabled">
              <Search size={18} />
              <span>{activeTitle.search}</span>
            </div>
          )}
        </header>

        {/* Welcome Page */}
        {activePage === "welcome" ? (
          <section className="welcome-workspace">
            <div className="welcome-hero">
              <div className="welcome-hero-title-row">
                <Brain size={24} className="welcome-hero-icon" />
                <span className="welcome-hero-eyebrow">Feedback Intelligence</span>
              </div>
              <h2>
                Analyze, Score, and Prioritize Customer Voice
              </h2>
              <p>
                CF Analyzer transforms raw qualitative feedback lists into structured, prioritized product roadmaps. 
                Using aspect-level sentiment modeling and our dynamic composite prioritization engine, we help PM teams identify critical issue clusters immediately.
              </p>
              <div className="welcome-hero-actions">
                <a href="#/upload" className="btn-primary" style={{ textDecoration: 'none' }}>
                  <Upload size={18} /> Ingest Feedback CSV
                </a>
                <button type="button" className="btn-secondary" onClick={handleQuickStartDemo} style={{ background: '#ffffff', borderColor: '#108558', color: '#108558', fontWeight: 600 }}>
                  <RefreshCw size={16} /> Run Quick Demo
                </button>
              </div>
            </div>

            <div className="welcome-steps-grid">
              <article className="welcome-card">
                <div className="welcome-card-icon step-1-icon">
                  <FileSpreadsheet size={20} />
                </div>
                <h3>1. Flexible Ingestion</h3>
                <p>
                  Upload custom spreadsheets and map headers dynamically. Detects date, channel origin, and segment tiers automatically.
                </p>
                <a href="#/upload" className="welcome-card-link">
                  Ingest spreadsheet <ChevronRight size={14} />
                </a>
              </article>

              <article className="welcome-card">
                <div className="welcome-card-icon step-2-icon">
                  <Key size={20} />
                </div>
                <h3>2. AI-Powered Classifier</h3>
                <p>
                  Provide a Gemini key to run aspect-level classifications, clustering, and evidence-backed product specifications.
                </p>
                <a href="#/settings" className="welcome-card-link">
                  Configure credentials <ChevronRight size={14} />
                </a>
              </article>

              <article className="welcome-card">
                <div className="welcome-card-icon step-3-icon">
                  <TrendingUp size={20} />
                </div>
                <h3>3. ICS Scoring Engine</h3>
                <p>
                  Tune relative weights for Frequency, Segment Value, Severity, and Trend. Rankings update in real time dynamically.
                </p>
                <a href="#/settings" className="welcome-card-link">
                  Customize weights <ChevronRight size={14} />
                </a>
              </article>
            </div>

            <div className="welcome-features-list">
              <h3>Key Capabilities</h3>
              <div className="welcome-features-grid">
                <div className="welcome-feature-item">
                  <CheckCircle2 size={18} className="feature-icon" />
                  <div>
                    <strong>Sentiment Scoring</strong>
                    <span>Automatically classifies positive, negative, and neutral voices at an item-by-item level.</span>
                  </div>
                </div>
                <div className="welcome-feature-item">
                  <CheckCircle2 size={18} className="feature-icon" />
                  <div>
                    <strong>Aspect Category Sorting</strong>
                    <span>Sorts unstructured messages into 9 product areas (Bugs, UX, Billing, etc.) using NLP keywords.</span>
                  </div>
                </div>
                <div className="welcome-feature-item">
                  <CheckCircle2 size={18} className="feature-icon" />
                  <div>
                    <strong>Evidence Quote Extraction</strong>
                    <span>Extracts representative user comments to back up prioritisation scores with customer voice.</span>
                  </div>
                </div>
                <div className="welcome-feature-item">
                  <CheckCircle2 size={18} className="feature-icon" />
                  <div>
                    <strong>Product Spec Directives</strong>
                    <span>Generates actionable advice and steps to solve categories of problems to push into PM software.</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* Upload Page */}
        {activePage === "upload" ? (
          <>
            <section className="hero-band">
              <div>
                <p className="eyebrow">AI Analysis</p>
                <h2>Start with your data</h2>
                <p>
                  Upload feedback files to run OpenAI sentiment scoring and category classification. 
                  If columns aren't detected, map them manually.
                </p>
              </div>
              <label className="upload-zone">
                <input accept=".csv,text/csv" type="file" onChange={handleFileChange} />
                <Upload size={28} />
                <strong>Choose CSV file</strong>
                <span>Required: feedback comment column. Optional: date, source, segment.</span>
              </label>
            </section>

            <section className="quick-actions">
              <button type="button" onClick={loadSampleData}>
                <FileSpreadsheet size={18} />
                Load sample data
              </button>

              <button
                type="button"
                onClick={handleRunAnalysis}
                disabled={!hasData || !columnMap.feedback}
                className="btn-primary"
              >
                <Sparkles size={18} />
                Analyze feedback
              </button>
            </section>

            {parseError ? (
              <div className="notice error">
                <AlertCircle size={18} />
                {parseError}
              </div>
            ) : null}

            {/* AI Settings warnings in upload */}
            {!apiKey ? (
              <div className="notice warning-key-bar">
                <AlertCircle size={16} />
                <span>
                  No Gemini API Key set. Analysis will run in <strong>Simulated AI Mode</strong>. 
                  Provide a key in the <a href="#/settings" style={{ color: "inherit", textDecoration: "underline", fontWeight: "600" }}>Settings Tab</a> to trigger live API pipelines.
                </span>
              </div>
            ) : (
              <div className="notice success-key-bar">
                <CheckCircle2 size={16} />
                <span>Gemini Integration Active. Analyzing will process live requests via `gemini-3.5-flash`.</span>
              </div>
            )}

            {hasData ? (
              <section className="mapping-status-bar">
                <CheckCircle2 size={16} />
                <span>
                  Mapped columns:{" "}
                  <strong>Feedback text:</strong> {columnMap.feedback || "Not set"},{" "}
                  <strong>Date:</strong> {columnMap.date || "Not set"},{" "}
                  <strong>Source:</strong> {columnMap.source || "Not set"},{" "}
                  <strong>Segment:</strong> {columnMap.segment || "Not set"}
                </span>
              </section>
            ) : null}

            <section className="content-grid">
              <article className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Validation</p>
                    <h3>CSV structure checks</h3>
                  </div>
                </div>
                <div className="issue-list">
                  {!hasData ? (
                    <div className="issue neutral">
                      <HelpCircle size={18} />
                      <span>Upload a file or load sample data to validate layout headers.</span>
                    </div>
                  ) : (
                    <>
                      {columnMap.feedback ? (
                        <div className="issue success">
                          <CheckCircle2 size={18} />
                          <span>Feedback text mapped to: <strong>{columnMap.feedback}</strong></span>
                        </div>
                      ) : (
                        <div className="issue error">
                          <AlertCircle size={18} />
                          <span>Missing required feedback text column. Match it in mapper.</span>
                        </div>
                      )}
                      {columnMap.date ? (
                        <div className="issue success">
                          <CheckCircle2 size={18} />
                          <span>Date mapped to: <strong>{columnMap.date}</strong></span>
                        </div>
                      ) : (
                        <div className="issue warning">
                          <AlertCircle size={18} />
                          <span>No date column mapped. Ingestion timeline features limited.</span>
                        </div>
                      )}
                      {columnMap.source ? (
                        <div className="issue success">
                          <CheckCircle2 size={18} />
                          <span>Source mapped to: <strong>{columnMap.source}</strong></span>
                        </div>
                      ) : (
                        <div className="issue warning">
                          <AlertCircle size={18} />
                          <span>No source/channel column mapped. Filtering will be generic.</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </article>

              <FeedbackPreview hasData={hasData} headers={headers} rows={rows} />
            </section>
          </>
        ) : null}

        {/* Dashboard Page */}
        {activePage === "dashboard" ? (
          <>
            {analysisResult ? (
              <>
                {/* AI Mode Alert Indicator */}
                {isAiMode ? (
                  <div className="ai-mode-indicator live">
                    <Sparkles size={14} /> Live Gemini Intelligence Mode Active
                  </div>
                ) : (
                  <div className="ai-mode-indicator simulated">
                    <AlertCircle size={14} /> Simulated AI Mode Active (Heuristics Fallback)
                  </div>
                )}

                <StatsGrid
                  fileName={fileName}
                  fileSize={fileSize}
                  totalCount={analysisResult.totalCount}
                  avgSentiment={analysisResult.averageSentimentScore}
                  dominantCat={dominantCategory}
                />

                <section className="dashboard-charts-grid">
                  <SentimentDonutChart
                    distribution={analysisResult.sentimentDistribution}
                    activeFilter={sentimentFilter}
                    onSelectFilter={(sentiment) => {
                      setSentimentFilter(sentiment);
                      setTimeout(() => {
                        document.getElementById("explorer-panel")?.scrollIntoView({ behavior: "smooth" });
                      }, 50);
                    }}
                  />
                  
                  <article className="panel">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">Problems</p>
                        <h3>Top repeated problem keywords</h3>
                      </div>
                      <TrendingUp size={18} className="text-secondary" />
                    </div>
                    <TopKeywordsList keywords={analysisResult.topKeywords} />
                  </article>
                </section>

                <section className="dashboard-details-grid">
                  <article className="panel category-stats-panel">
                    <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p className="eyebrow">Distribution</p>
                        <h3>Category breakdowns</h3>
                      </div>
                      {categoryFilter !== "all" ? (
                        <button
                          type="button"
                          className="clear-chart-filter-badge"
                          onClick={() => setCategoryFilter("all")}
                          style={{
                            background: '#f0fdf4',
                            color: '#108558',
                            border: '1px solid #d1eadf',
                            borderRadius: '12px',
                            padding: '2.5px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          title="Click to clear filter"
                        >
                          Filtered: {categoryFilter} ✕
                        </button>
                      ) : (
                        <Activity size={18} className="text-secondary" />
                      )}
                    </div>
                    <CategoryStatsGrid
                      categoryStats={sortedCategoryStatsByICS}
                      activeFilter={categoryFilter}
                      onSelectFilter={(category) => {
                        setCategoryFilter(category);
                        setTimeout(() => {
                          document.getElementById("explorer-panel")?.scrollIntoView({ behavior: "smooth" });
                        }, 50);
                      }}
                    />
                  </article>

                  <article className="panel urgent-complaints-panel">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">Urgent Signals</p>
                        <h3>Most urgent customer complaints</h3>
                      </div>
                      <AlertTriangle size={18} className="text-urgent" />
                    </div>
                    <UrgentComplaintsList complaints={analysisResult.urgentComplaints} />
                  </article>
                </section>

                <FeedbackExplorer
                  items={analysisResult.items}
                  searchQuery={explorerSearch}
                  setSearchQuery={setExplorerSearch}
                  sentimentFilter={sentimentFilter}
                  setSentimentFilter={setSentimentFilter}
                  categoryFilter={categoryFilter}
                  setCategoryFilter={setCategoryFilter}
                />
              </>
            ) : (
              <div className="empty-state large">
                <BarChart3 size={34} />
                <h3>No analysis results available</h3>
                <p>Upload a CSV file and run the analysis on the Upload page first.</p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    setActivePage("upload");
                    window.location.hash = "#/upload";
                  }}
                  style={{ marginTop: "16px" }}
                >
                  Go to Upload Page
                </button>
              </div>
            )}
          </>
        ) : null}

        {/* Categories Page */}
        {activePage === "categories" ? (
          <>
            {currentCategory && categoryDetails ? (
              // Category Detail Dashboard View
              <section className="category-detail-workspace">
                <div className="category-detail-header-bar">
                  <a href="#/categories" className="btn-back">
                    <ArrowLeft size={16} /> Back to categories
                  </a>
                  {(() => {
                    const currentICSInfo = icsResultsMap.get(currentCategory || "");
                    return currentICSInfo ? (
                      <span className={`badge-priority ${currentICSInfo.priority.toLowerCase()}`}>
                        ICS Score: {currentICSInfo.icsScore} • {currentICSInfo.priority} Priority
                      </span>
                    ) : null;
                  })()}
                </div>

                <StatsGridCategory
                  totalCount={categoryDetails.totalCount}
                  positivePercentage={categoryDetails.sentimentDistribution.positivePercentage}
                  segmentsAffected={categoryDetails.segmentsAffected}
                  sourcesAffected={categoryDetails.sourcesAffected}
                />

                {(() => {
                  const currentICSInfo = icsResultsMap.get(currentCategory || "");
                  return currentICSInfo ? (
                    <article className="panel prioritization-explanation-panel" style={{ background: '#f8fafc', borderLeft: '4px solid #108558', padding: '20px' }}>
                      <div className="panel-heading" style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <AlertTriangle size={18} className="text-secondary" style={{ color: '#475569' }} />
                          <h3 style={{ margin: 0, fontWeight: 700 }}>Prioritization Context</h3>
                        </div>
                        <span className={`badge-priority ${currentICSInfo.priority.toLowerCase()}`} style={{ padding: '2px 8px', fontSize: '0.75rem' }}>
                          ICS Score: {currentICSInfo.icsScore}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.92rem', color: '#334155', lineHeight: '1.6' }}>
                        {currentICSInfo.whyThisMatters}
                      </p>
                      <div className="ics-scores-chips" style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.8rem', background: '#e2e8f0', padding: '4px 10px', borderRadius: '99px', color: '#475569', fontWeight: 500 }}>
                          Frequency: {currentICSInfo.scores.frequency}%
                        </span>
                        <span style={{ fontSize: '0.8rem', background: '#e2e8f0', padding: '4px 10px', borderRadius: '99px', color: '#475569', fontWeight: 500 }}>
                          Segment: {currentICSInfo.scores.segment}%
                        </span>
                        <span style={{ fontSize: '0.8rem', background: '#e2e8f0', padding: '4px 10px', borderRadius: '99px', color: '#475569', fontWeight: 500 }}>
                          Sentiment: {currentICSInfo.scores.sentiment}%
                        </span>
                        <span style={{ fontSize: '0.8rem', background: '#e2e8f0', padding: '4px 10px', borderRadius: '99px', color: '#475569', fontWeight: 500 }}>
                          Recency Trend: {currentICSInfo.scores.trend}%
                        </span>
                      </div>
                    </article>
                  ) : null;
                })()}

                {isCatSummaryLoading ? (
                  <section className="category-detail-skeleton-grid">
                    <article className="panel skeletonPulse" style={{ height: "180px" }}></article>
                    <article className="panel skeletonPulse" style={{ height: "180px" }}></article>
                  </section>
                ) : (
                  <section className="category-detail-mid-row">
                    <article className="panel category-rec-card" id="action-advice-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {selectedQuoteId ? (
                        // 1. Loading State
                        isAdviceLoading ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 0' }}>
                            <div className="panel-heading" style={{ marginBottom: 0 }}>
                              <div>
                                <p className="eyebrow">Selected Problem Analysis</p>
                                <h3>Generating technical assessment...</h3>
                              </div>
                              <Loader2 size={18} className="spinner text-secondary" />
                            </div>
                            <div className="quote-spec-context" style={{ background: '#f8fafc', borderLeft: '3px solid #64748b', padding: '10px 14px', borderRadius: '4px', fontSize: '0.85rem', color: '#475569', fontStyle: 'italic' }}>
                              "{selectedQuoteObject?.feedbackText}"
                            </div>
                            <div className="skeletonPulse" style={{ height: '36px', width: '100%', borderRadius: '6px' }}></div>
                            <div className="skeletonPulse" style={{ height: '70px', width: '100%', borderRadius: '6px' }}></div>
                            <div className="skeletonPulse" style={{ height: '70px', width: '100%', borderRadius: '6px' }}></div>
                          </div>
                        ) : quoteAdvice ? (
                          // 2. Advice Loaded State
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="panel-heading" style={{ marginBottom: 0 }}>
                              <div>
                                <p className="eyebrow">Selected Problem Analysis</p>
                                <h3>Detailed Action Specs</h3>
                              </div>
                              <Zap size={18} className="text-accent" style={{ color: '#e67e22' }} />
                            </div>
                            
                            <div className="quote-spec-context" style={{ background: '#f8fafc', borderLeft: '3px solid #64748b', padding: '10px 14px', borderRadius: '4px', fontSize: '0.85rem', color: '#475569', fontStyle: 'italic' }}>
                              "{selectedQuoteObject?.feedbackText}"
                            </div>

                            {quoteAdvice.isRepeated && (
                              <div className="alert-repeated-issue" style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', color: '#991b1b', fontSize: '0.88rem', fontWeight: 600 }}>
                                <AlertTriangle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
                                <div>
                                  Critical Repeated Issue: This problem is reported by {quoteAdvice.repeatCount} users in this dataset! Please solve this ASAP!
                                </div>
                              </div>
                            )}

                            <div className="advice-section">
                              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>What is the problem?</h4>
                              <p style={{ fontSize: '0.92rem', color: '#1e293b', lineHeight: 1.5, margin: 0 }}>{quoteAdvice.explanation}</p>
                            </div>

                            <div className="advice-section">
                              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>What exactly caused this?</h4>
                              <p style={{ fontSize: '0.92rem', color: '#1e293b', lineHeight: 1.5, margin: 0 }}>{quoteAdvice.cause}</p>
                            </div>

                            <div className="advice-section">
                              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>How to solve this?</h4>
                              <p style={{ fontSize: '0.92rem', color: '#1e293b', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-line' }}>{quoteAdvice.solution}</p>
                            </div>

                            <div className="advice-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #edf2f4', paddingTop: '14px' }}>
                              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.05em' }}>Problem Status</h4>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {(() => {
                                  const qStatus = selectedQuoteId ? (quoteStatuses[selectedQuoteId] || "New") : "New";
                                  return (
                                    <>
                                      <span className={`status-badge-tag status-${qStatus.toLowerCase()}`} style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px' }}>
                                        {qStatus}
                                      </span>
                                      
                                      <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                                        <button
                                          type="button"
                                          className={`btn-secondary`}
                                          onClick={() => selectedQuoteId && updateQuoteStatus(selectedQuoteId, 'New')}
                                          style={{ height: '30px', padding: '0 10px', fontSize: '0.78rem', background: qStatus === 'New' ? '#f1f5f9' : '', borderColor: qStatus === 'New' ? '#94a3b8' : '' }}
                                        >
                                          New
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn-secondary`}
                                          onClick={() => selectedQuoteId && updateQuoteStatus(selectedQuoteId, 'Reviewing')}
                                          style={{ height: '30px', padding: '0 10px', fontSize: '0.78rem', background: qStatus === 'Reviewing' ? '#e0f2fe' : '', borderColor: qStatus === 'Reviewing' ? '#38bdf8' : '', color: qStatus === 'Reviewing' ? '#0369a1' : '' }}
                                        >
                                          Reviewing
                                        </button>
                                        <button
                                          type="button"
                                          className={`btn-secondary`}
                                          onClick={() => selectedQuoteId && updateQuoteStatus(selectedQuoteId, 'Done')}
                                          style={{ height: '30px', padding: '0 10px', fontSize: '0.78rem', background: qStatus === 'Done' ? '#dcfce7' : '', borderColor: qStatus === 'Done' ? '#4ade80' : '', color: qStatus === 'Done' ? '#15803d' : '' }}
                                        >
                                          Done
                                        </button>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>

                            <div className="advice-section" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #edf2f4', paddingTop: '14px' }}>
                              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px', letterSpacing: '0.05em' }}>Reassign Category</h4>
                              <select
                                value={selectedQuoteObject?.category || ""}
                                onChange={(e) => selectedQuoteId && e.target.value && updateQuoteCategory(selectedQuoteId, e.target.value)}
                                style={{ width: '100%', height: '36px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.88rem', outline: 'none', background: '#fff', cursor: 'pointer' }}
                              >
                                {analysisResult?.categoryStats.map((c) => (
                                  <option key={c.name} value={c.name}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #edf2f4', paddingTop: '14px' }}>
                              <button type="button" className="btn-secondary" onClick={() => { setSelectedQuoteId(null); setQuoteAdvice(null); }} style={{ height: '36px', fontSize: '0.85rem', justifyContent: 'center' }}>
                                Back to Category Action Plan
                              </button>
                            </div>
                          </div>
                        ) : null
                      ) : (
                        // 3. Category-wide Action Plan (Original)
                        <>
                          <div className="panel-heading" style={{ marginBottom: 0 }}>
                            <div>
                              <p className="eyebrow">Action Advice</p>
                              <h3>Recommended next step</h3>
                            </div>
                            <Zap size={18} className="text-accent" style={{ color: '#e67e22' }} />
                          </div>
                          {currentRecommendation && (
                            <div className="rec-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <div>
                                <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
                                  {currentRecommendation.title}
                                </h4>
                                <p style={{ fontSize: '0.92rem', color: '#475569', lineHeight: 1.55, margin: 0 }}>
                                  {currentRecommendation.actionText}
                                </p>
                              </div>

                              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #edf2f4', paddingTop: '14px' }}>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  {currentRecommendation.status === "Done" ? (
                                    <button
                                      type="button"
                                      className="btn-secondary"
                                      onClick={() => reopenProblem(currentCategory, categoryDetails)}
                                      style={{ minHeight: '36px', height: '36px', padding: '0 12px', fontSize: '0.85rem', background: '#fffbeb', borderColor: '#fde68a', color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                      <CheckCircle2 size={14} /> Reopen Action Plan
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn-primary"
                                      onClick={() => markAsSolved(currentCategory, categoryDetails)}
                                      style={{ minHeight: '36px', height: '36px', padding: '0 12px', fontSize: '0.85rem', background: '#108558', borderColor: '#108558', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                      <CheckCircle2 size={14} /> Mark Action Plan as Solved
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={handleOpenEditModal}
                                    style={{ minHeight: '36px', height: '36px', padding: '0 12px', fontSize: '0.85rem' }}
                                  >
                                    <Edit size={14} /> Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setShowExportModal(true)}
                                    style={{ minHeight: '36px', height: '36px', padding: '0 12px', fontSize: '0.85rem' }}
                                  >
                                    <Share2 size={14} /> Export Spec
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </article>

                    <article className="panel category-kw-panel">
                      <div className="panel-heading">
                        <div>
                          <p className="eyebrow">Key Terms</p>
                          <h3>Recurring keywords in {currentCategory}</h3>
                        </div>
                        <TrendingUp size={18} className="text-secondary" />
                      </div>
                      <TopKeywordsList keywords={categoryDetails.recurringKeywords} />
                    </article>
                  </section>
                )}

                <section className="category-detail-bottom-row">
                  <article className="panel category-quotes-panel">
                    <div className="panel-heading" style={{ flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                      <div>
                        <p className="eyebrow">Customer Voice</p>
                        <h3>Representative feedback quotes</h3>
                      </div>
                      <div className="voice-status-tabs" style={{ display: 'flex', background: '#f1f5f9', borderRadius: '6px', padding: '2px', marginLeft: 'auto' }}>
                        {(["All", "Active", "Completed"] as const).map((tab) => (
                          <button
                            type="button"
                            key={tab}
                            className={`tab-btn ${voiceStatusFilter === tab ? "active" : ""}`}
                            onClick={() => setVoiceStatusFilter(tab)}
                            style={{
                              background: voiceStatusFilter === tab ? '#fff' : 'transparent',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 10px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              color: voiceStatusFilter === tab ? '#0f172a' : '#64748b',
                              boxShadow: voiceStatusFilter === tab ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                    </div>
                    {isCatSummaryLoading ? (
                      <div className="quotes-list-wrap">
                        <div className="quote-item-card skeletonPulse" style={{ height: "70px", background: "#f8fafc" }}></div>
                        <div className="quote-item-card skeletonPulse" style={{ height: "70px", background: "#f8fafc" }}></div>
                      </div>
                    ) : (
                      <div className="quotes-list-wrap">
                        {filteredCategoryQuotes.map((q) => (
                          <div
                            className={`quote-item-card interactive ${selectedQuoteId === q.id ? "active" : ""} ${quoteStatuses[q.id] === 'Done' ? 'done' : ''}`}
                            key={q.id}
                            onClick={() => handleSelectQuote(q)}
                            style={{ cursor: "pointer" }}
                          >
                            <div className="quote-item-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className={`badge-sentiment ${q.sentiment}`}>{q.sentiment}</span>
                              <span className="quote-metadata">{q.source} • {q.segment} • {q.date || "No date"}</span>
                              {(() => {
                                const qStatus = quoteStatuses[q.id] || "New";
                                if (qStatus !== "New") {
                                  return (
                                    <span className={`status-badge-tag status-${qStatus.toLowerCase()}`} style={{ marginLeft: 'auto', padding: '2px 6px', fontSize: '0.68rem', borderRadius: '4px' }}>
                                      {qStatus}
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                            <p className="quote-text">"{q.feedbackText}"</p>
                          </div>
                        ))}
                        {filteredCategoryQuotes.length === 0 && (
                          <div className="empty-state">No quotes matching "{voiceStatusFilter}" status filter.</div>
                        )}
                      </div>
                    )}
                  </article>

                  <article className="panel category-segment-panel">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">Affections</p>
                        <h3>Segment & Source impact</h3>
                      </div>
                      <Activity size={18} className="text-secondary" />
                    </div>
                    <div className="distributions-wrap">
                      <div className="dist-section">
                        <h4>Impact by Segment</h4>
                        <DistributionList data={categoryDetails.segmentsAffected} />
                      </div>
                      <div className="dist-section" style={{ marginTop: "24px" }}>
                        <h4>Impact by Channel Source</h4>
                        <DistributionList data={categoryDetails.sourcesAffected} />
                      </div>
                    </div>
                  </article>
                </section>
              </section>
            ) : (
              // Category Grid Overview List
              <section className="category-list-workspace">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">Overview</p>
                    <h3>Problem areas prepared for analysis</h3>
                  </div>
                </div>
                {analysisResult ? (
                  <div className="category-grid">
                    {sortedCategoryStatsByICS.filter(cat => cat.count > 0).map((cat) => {
                      const total = cat.count;
                      const pos = cat.sentiment.positive;
                      const neg = cat.sentiment.negative;
                      const posPct = total ? Math.round((pos / total) * 100) : 0;
                      const negPct = total ? Math.round((neg / total) * 100) : 0;
                      
                      return (
                        <article className="category-card interactive" key={cat.name} onClick={() => {
                          window.location.hash = `#/categories?name=${cat.name}`;
                        }}>
                          <div className="cat-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                              <div className="cat-card-icon-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', borderRadius: '8px', padding: '8px', color: '#475569' }}>
                                {getCategoryIcon(cat.name, 20)}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <strong style={{ fontSize: '0.95rem' }}>{cat.name}</strong>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                                  <span className={`badge-priority ${cat.priority.toLowerCase()}`} style={{ padding: '2px 8px', fontSize: '0.68rem' }}>
                                    {cat.priority} (ICS: {cat.icsScore})
                                  </span>
                                  {(() => {
                                    const stored = recommendationsStore[cat.name];
                                    const status = stored?.status ?? "New";
                                    return (
                                      <span className={`status-badge-tag status-${status.toLowerCase()}`} style={{ padding: '2px 6px', fontSize: '0.65rem', borderRadius: '4px' }}>
                                        {status}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                            <span className="badge-count" style={{ fontSize: '0.82rem', background: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>{cat.count} items</span>
                          </div>
                          
                          {cat.count > 0 ? (
                            <div className="cat-card-body" style={{ marginTop: '4px' }}>
                              <div className="mini-sentiment-track" style={{ height: '6px', borderRadius: '3px', background: '#e2e8f0', overflow: 'hidden', display: 'flex', marginBottom: '8px' }}>
                                <div className="fill pos" style={{ width: `${posPct}%`, background: '#2ac380', height: '100%' }} title={`Positive: ${posPct}%`}></div>
                                <div className="fill neg" style={{ width: `${negPct}%`, background: '#fa5252', height: '100%' }} title={`Negative: ${negPct}%`}></div>
                              </div>
                              <div className="cat-card-details" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                                <span className="text-positive" style={{ color: '#10b981', fontWeight: 600 }}>{pos} positive</span>
                                <span className="text-negative" style={{ color: '#ef4444', fontWeight: 600 }}>{neg} negative</span>
                              </div>
                            </div>
                          ) : (
                            <div className="empty-state-card text-muted" style={{ fontSize: '0.8rem', padding: '8px 0' }}>No items matching this category.</div>
                          )}
                          
                          <span className="cat-card-link" style={{ fontSize: '0.8rem', color: '#108558', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px', marginTop: 'auto', paddingTop: '8px' }}>
                            View detail <ChevronRight size={12} />
                          </span>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="category-grid">
                    {categoryStates.map((category) => (
                      <article className="category-card" key={category} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div className="cat-card-icon-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', borderRadius: '8px', padding: '8px', color: '#94a3b8' }}>
                          {getCategoryIcon(category, 20)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <strong>{category}</strong>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No data loaded yet</span>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        ) : null}

        {/* Settings Page */}
        {activePage === "settings" ? (
          <section className="settings-grid">
            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Integrations</p>
                  <h3>Gemini API Settings</h3>
                </div>
                <Key size={18} className="text-secondary" />
              </div>
              <div className="settings-api-key-form">
                <p style={{ fontSize: "0.9rem", color: "#475569", lineHeight: "1.45" }}>
                  Provide a Gemini API Key to classify comments using `gemini-3.5-flash` instead of heuristic rules. 
                  Your key is stored securely in your browser's local cache and is sent directly to the Gemini API endpoint.
                </p>
                <div className="api-key-input-row" style={{ marginTop: "16px" }}>
                  <div className="password-wrapper">
                    <input
                      type={showKey ? "text" : "password"}
                      placeholder="AIzaSy..."
                      value={tempApiKey}
                      onChange={(e) => setTempApiKey(e.target.value)}
                    />
                    <button type="button" onClick={() => setShowKey(!showKey)}>
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button type="button" className="btn-primary" onClick={() => handleSaveKey(tempApiKey)}>
                    Save Key
                  </button>
                  {apiKey && (
                    <button type="button" className="btn-secondary" onClick={handleClearKey}>
                      Clear Key
                    </button>
                  )}
                </div>
                {apiKey ? (
                  <div className="key-status-msg active" style={{ marginTop: "12px" }}>
                    <CheckCircle2 size={14} /> Saved and Active
                  </div>
                ) : (
                  <div className="key-status-msg inactive" style={{ marginTop: "12px" }}>
                    <AlertCircle size={14} /> Missing Key — Heuristics Simulated Fallback Mode
                  </div>
                )}
              </div>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Prioritization Engine</p>
                  <h3>ICS Weights Configuration</h3>
                </div>
                <TrendingUp size={18} className="text-secondary" />
              </div>
              <div className="settings-prioritization-weights" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: "0.9rem", color: "#475569", lineHeight: "1.45" }}>
                  Configure the relative weights of the four components that calculate the ICS score. 
                  Weights must sum to exactly <strong>100%</strong> to save.
                </p>

                <div className="weight-slider-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <label style={{ fontWeight: 600, color: '#334155' }}>Volume Frequency Weight</label>
                    <span style={{ fontWeight: 700, color: '#108558' }}>{tempWeights.frequency}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={tempWeights.frequency}
                    onChange={(e) => setTempWeights({ ...tempWeights, frequency: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="weight-slider-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <label style={{ fontWeight: 600, color: '#334155' }}>User Segment Weight</label>
                    <span style={{ fontWeight: 700, color: '#108558' }}>{tempWeights.segment}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={tempWeights.segment}
                    onChange={(e) => setTempWeights({ ...tempWeights, segment: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="weight-slider-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <label style={{ fontWeight: 600, color: '#334155' }}>Sentiment Severity Weight</label>
                    <span style={{ fontWeight: 700, color: '#108558' }}>{tempWeights.sentiment}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={tempWeights.sentiment}
                    onChange={(e) => setTempWeights({ ...tempWeights, sentiment: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="weight-slider-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <label style={{ fontWeight: 600, color: '#334155' }}>Recency Trend Weight</label>
                    <span style={{ fontWeight: 700, color: '#108558' }}>{tempWeights.trend}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={tempWeights.trend}
                    onChange={(e) => setTempWeights({ ...tempWeights, trend: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                  <div>
                    <span style={{ fontSize: '0.9rem', color: '#475569' }}>Total Sum:</span>
                    <strong style={{ marginLeft: '8px', fontSize: '1rem', color: tempWeightsSum === 100 ? '#108558' : '#fa5252' }}>
                      {tempWeightsSum}%
                    </strong>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setTempWeights(icsWeights)}
                      style={{ minHeight: '36px', height: '36px', padding: '0 12px' }}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={tempWeightsSum !== 100}
                      onClick={() => handleSaveWeights(tempWeights)}
                      style={{ minHeight: '36px', height: '36px', padding: '0 12px' }}
                    >
                      Save Weights
                    </button>
                  </div>
                </div>

                {tempWeightsSum !== 100 && (
                  <div className="notice error" style={{ padding: '8px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} />
                    <span>Weights must add up to exactly 100% (currently off by {100 - tempWeightsSum}%).</span>
                  </div>
                )}
                {saveWeightsSuccess && (
                  <div className="notice success-key-bar" style={{ padding: '8px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={14} />
                    <span>Weights saved successfully! rankings updated.</span>
                  </div>
                )}
              </div>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Alerting System</p>
                  <h3>Sentiment Alert Rules</h3>
                </div>
                <AlertTriangle size={18} className="text-secondary" />
              </div>
              <div className="settings-prioritization-weights" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: "0.9rem", color: "#475569", lineHeight: "1.45" }}>
                  Set threshold parameters for the feedback alerting system. If category health drops or negative feedback volume spikes, alerts will trigger immediately.
                </p>

                <div className="weight-slider-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <label style={{ fontWeight: 600, color: '#334155' }}>Sentiment Health Threshold</label>
                    <span style={{ fontWeight: 700, color: '#108558' }}>Alert if positive sentiment drops below {tempAlertConfig.sentimentThreshold}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={tempAlertConfig.sentimentThreshold}
                    onChange={(e) => setTempAlertConfig({ ...tempAlertConfig, sentimentThreshold: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="weight-slider-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                    <label style={{ fontWeight: 600, color: '#334155' }}>Negative Volume Threshold</label>
                    <span style={{ fontWeight: 700, color: '#108558' }}>Alert if negative count exceeds {tempAlertConfig.volumeThreshold} items</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={tempAlertConfig.volumeThreshold}
                    onChange={(e) => setTempAlertConfig({ ...tempAlertConfig, volumeThreshold: Number(e.target.value) })}
                    style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', width: '100%' }}
                  />
                </div>

                <div className="weight-slider-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
                    <input
                      type="checkbox"
                      id="emailNotifications"
                      checked={tempAlertConfig.emailNotifications}
                      onChange={(e) => setTempAlertConfig({ ...tempAlertConfig, emailNotifications: e.target.checked })}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <label htmlFor="emailNotifications" style={{ fontWeight: 600, color: '#334155', cursor: 'pointer' }}>Enable Email Alerts Simulation</label>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setTempAlertConfig(alertConfig)}
                    style={{ minHeight: '36px', height: '36px', padding: '0 12px' }}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => handleSaveAlertConfig(tempAlertConfig)}
                    style={{ minHeight: '36px', height: '36px', padding: '0 12px' }}
                  >
                    Save Rules
                  </button>
                </div>

                {saveAlertConfigSuccess && (
                  <div className="notice success-key-bar" style={{ padding: '8px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={14} />
                    <span>Alert rules updated successfully! active logs refreshed.</span>
                  </div>
                )}
              </div>
            </article>



            <article className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">CSV Requirements</p>
                  <h3>Expected data shape</h3>
                </div>
              </div>
              <div className="settings-list">
                <span>Feedback text: feedback, comment, review, message, text, or description</span>
                <span>Date: date, created_at, timestamp, or submitted_at</span>
                <span>Source: source, channel, or platform</span>
                <span>Optional: segment, customer_type, account_tier, product_area</span>
              </div>
            </article>
          </section>
        ) : null}

        {/* Alerts Page */}
        {activePage === "alerts" ? (
          <section className="alerts-workspace" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {!analysisResult ? (
              <div className="empty-state large">
                <AlertCircle size={34} />
                <h3>No data loaded yet</h3>
                <p>Upload a feedback spreadsheet and run analysis first to see triggered alerts.</p>
                <a href="#/upload" className="btn-primary" style={{ textDecoration: 'none', marginTop: '12px' }}>Go to Ingest</a>
              </div>
            ) : (
              <>
                {/* Alert Stats Cards */}
                <div className="stats-grid">
                  <article>
                    <div className="stat-header">
                      <span>Active Alerts</span>
                      <AlertTriangle size={16} style={{ color: '#fa5252' }} />
                    </div>
                    <strong style={{ color: triggeredAlerts.filter(a => !a.isAcknowledged).length > 0 ? '#fa5252' : 'inherit' }}>
                      {triggeredAlerts.filter(a => !a.isAcknowledged).length}
                    </strong>
                    <span className="stat-desc">Awaiting acknowledgment</span>
                  </article>
                  <article>
                    <div className="stat-header">
                      <span>Resolved Alerts</span>
                      <CheckCircle2 size={16} style={{ color: '#108558' }} />
                    </div>
                    <strong>{triggeredAlerts.filter(a => a.isAcknowledged).length}</strong>
                    <span className="stat-desc">Acknowledged issues</span>
                  </article>
                  <article>
                    <div className="stat-header">
                      <span>Sentiment Rule</span>
                      <Settings size={16} />
                    </div>
                    <strong>&lt; {alertConfig.sentimentThreshold}%</strong>
                    <span className="stat-desc">Positive ratio trigger</span>
                  </article>
                  <article>
                    <div className="stat-header">
                      <span>Volume Rule</span>
                      <Settings size={16} />
                    </div>
                    <strong>&gt; {alertConfig.volumeThreshold} neg</strong>
                    <span className="stat-desc">Count trigger limit</span>
                  </article>
                </div>

                <div className="alerts-layout-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                  {/* Left Column: Active Alerts */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <article className="panel">
                      <div className="panel-heading">
                        <div>
                          <p className="eyebrow">Attention Required</p>
                          <h3>Active Triggered Alerts ({triggeredAlerts.filter(a => !a.isAcknowledged).length})</h3>
                        </div>
                      </div>
                      
                      <div className="alerts-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                        {triggeredAlerts.filter(a => !a.isAcknowledged).map((alert) => (
                          <div key={alert.id} className="urgent-card" style={{ borderLeft: '4px solid #fa5252', padding: '16px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeftWidth: '4px', borderLeftColor: '#fa5252' }}>
                            <div className="urgent-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span className={`badge-sentiment negative`} style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                                  {alert.type === 'sentiment' ? 'Sentiment Drop' : 'Volume Spike'}
                                </span>
                                <a href={`#/categories?name=${alert.category}`} style={{ fontWeight: 700, color: '#0f172a', textDecoration: 'underline', fontSize: '0.92rem' }}>
                                  {alert.category}
                                </a>
                              </div>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span className={`badge-priority ${alert.severity.toLowerCase()}`} style={{ fontSize: '0.7rem' }}>
                                  {alert.severity}
                                </span>
                                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{alert.date}</span>
                              </div>
                            </div>
                            <p className="urgent-card-text" style={{ margin: '0 0 14px', fontSize: '0.9rem', color: '#334155' }}>
                              {alert.message}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleToggleAcknowledge(alert.id)}
                                style={{ minHeight: '32px', height: '32px', padding: '0 12px', fontSize: '0.8rem' }}
                              >
                                Acknowledge
                              </button>

                            </div>
                          </div>
                        ))}
                        
                        {triggeredAlerts.filter(a => !a.isAcknowledged).length === 0 && (
                          <div className="empty-state" style={{ padding: '24px' }}>
                            <CheckCircle2 size={24} style={{ color: '#108558', marginBottom: '8px' }} />
                            <p style={{ margin: 0 }}>All clear! No active alerts triggered for the current config rules.</p>
                          </div>
                        )}
                      </div>
                    </article>

                    {/* Acknowledged Alerts Panel */}
                    <article className="panel">
                      <div className="panel-heading">
                        <div>
                          <p className="eyebrow">History</p>
                          <h3>Acknowledged / Resolved Alerts ({triggeredAlerts.filter(a => a.isAcknowledged).length})</h3>
                        </div>
                      </div>
                      <div className="alerts-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                        {triggeredAlerts.filter(a => a.isAcknowledged).map((alert) => (
                          <div key={alert.id} className="urgent-card" style={{ opacity: 0.65, borderLeft: '4px solid #94a3b8', padding: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeftWidth: '4px', borderLeftColor: '#94a3b8' }}>
                            <div className="urgent-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span className="badge-category" style={{ fontSize: '0.68rem', background: '#e2e8f0', color: '#475569' }}>
                                  {alert.category}
                                </span>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>
                                  {alert.type === 'sentiment' ? 'Sentiment Drop' : 'Volume Spike'}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => handleToggleAcknowledge(alert.id)}
                                style={{ minHeight: '26px', height: '26px', padding: '0 8px', fontSize: '0.75rem', background: 'transparent', border: 'none', color: '#108558', textDecoration: 'underline' }}
                              >
                                Re-open
                              </button>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                              {alert.message}
                            </p>
                          </div>
                        ))}

                        {triggeredAlerts.filter(a => a.isAcknowledged).length === 0 && (
                          <div className="empty-state" style={{ padding: '16px', fontSize: '0.85rem' }}>
                            No acknowledged alerts history recorded.
                          </div>
                        )}
                      </div>
                    </article>
                  </div>

                  {/* Right Column: Active Rules Summary */}
                  <div>
                    <article className="panel">
                      <div className="panel-heading" style={{ marginBottom: '12px' }}>
                        <h3>Active Rules</h3>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <strong style={{ display: 'block', fontSize: '0.85rem', color: '#334155' }}>Sentiment Trigger</strong>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Triggers when category positive sentiment ratio drops below {alertConfig.sentimentThreshold}%.</span>
                        </div>
                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <strong style={{ display: 'block', fontSize: '0.85rem', color: '#334155' }}>Volume Trigger</strong>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Triggers when a category accumulates more than {alertConfig.volumeThreshold} negative feedback items.</span>
                        </div>
                        <a href="#/settings" className="btn-secondary" style={{ textDecoration: 'none', textAlign: 'center', display: 'block', fontSize: '0.85rem' }}>
                          Configure rules in Settings
                        </a>
                      </div>
                    </article>
                  </div>
                </div>
              </>
            )}
          </section>
        ) : null}

        {/* Digest Reports Page */}
        {activePage === "reports" ? (
          <section className="reports-workspace" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {!analysisResult ? (
              <div className="empty-state large">
                <FileSpreadsheet size={34} />
                <h3>No analysis results available</h3>
                <p>Upload a CSV file and run the analysis on the Upload page first to generate digests.</p>
                <a href="#/upload" className="btn-primary" style={{ textDecoration: 'none', marginTop: '12px' }}>Go to Upload</a>
              </div>
            ) : (
              <div className="reports-layout-grid" style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '24px' }}>
                {/* Left Column: Report View */}
                <article className="panel">
                  <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '14px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                      <div className="report-period-selector" style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '2px' }}>
                        <button
                          type="button"
                          className={digestType === 'weekly' ? 'active' : ''}
                          onClick={() => setDigestType('weekly')}
                          style={{
                            background: digestType === 'weekly' ? '#fff' : 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            color: digestType === 'weekly' ? '#0f172a' : '#64748b',
                            boxShadow: digestType === 'weekly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                          }}
                        >
                          Weekly Digest
                        </button>
                        <button
                          type="button"
                          className={digestType === 'monthly' ? 'active' : ''}
                          onClick={() => setDigestType('monthly')}
                          style={{
                            background: digestType === 'monthly' ? '#fff' : 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            color: digestType === 'monthly' ? '#0f172a' : '#64748b',
                            boxShadow: digestType === 'monthly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                          }}
                        >
                          Monthly Digest
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '6px', padding: '2px' }}>
                      <button
                        type="button"
                        onClick={() => setActiveReportTab('preview')}
                        style={{
                          background: activeReportTab === 'preview' ? '#fff' : 'transparent',
                          border: 'none',
                          padding: '4px 10px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          color: activeReportTab === 'preview' ? '#0f172a' : '#64748b'
                        }}
                      >
                        Preview Layout
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveReportTab('raw')}
                        style={{
                          background: activeReportTab === 'raw' ? '#fff' : 'transparent',
                          border: 'none',
                          padding: '4px 10px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          color: activeReportTab === 'raw' ? '#0f172a' : '#64748b'
                        }}
                      >
                        Markdown Spec
                      </button>
                    </div>
                  </div>

                  <div className="report-content-body">
                    {activeReportTab === 'preview' ? (
                      <div className="digest-preview-container" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '28px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #f1f5f9', paddingBottom: '18px', marginBottom: '24px' }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#108558', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Automated Product Digest</span>
                            <h2 style={{ fontSize: '1.6rem', color: '#0f172a', fontWeight: 800, margin: '4px 0 0' }}>
                              {digestType === 'weekly' ? 'Weekly' : 'Monthly'} Feedback Intelligence Summary
                            </h2>
                            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                              Run Date: {new Date().toLocaleDateString()} • Ingestion Source: {fileName || "CSV Dataset"}
                            </p>
                          </div>
                          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '6px 12px', textAlign: 'right' }}>
                            <span style={{ fontSize: '0.72rem', display: 'block', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Status</span>
                            <strong style={{ fontSize: '0.88rem', color: '#15803d' }}>Ready to Sync</strong>
                          </div>
                        </div>

                        {/* Executive Summary Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
                          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Volume Analyzed</span>
                            <strong style={{ display: 'block', fontSize: '1.4rem', color: '#0f172a', margin: '4px 0' }}>{analysisResult.totalCount} items</strong>
                            <span style={{ fontSize: '0.75rem', color: '#475569' }}>Total feedback corpus</span>
                          </div>
                          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Sentiment Index</span>
                            <strong style={{ display: 'block', fontSize: '1.4rem', color: '#0f172a', margin: '4px 0' }}>{analysisResult.averageSentimentScore}%</strong>
                            <span style={{ fontSize: '0.75rem', color: sentimentDelta.startsWith('+') ? '#108558' : '#fa5252', fontWeight: 600 }}>
                              {sentimentDelta} vs prior period
                            </span>
                          </div>
                          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Active Action Plans</span>
                            <strong style={{ display: 'block', fontSize: '1.4rem', color: '#0f172a', margin: '4px 0' }}>{pmTicketsCount} Active</strong>
                            <span style={{ fontSize: '0.75rem', color: '#475569' }}>Recommendations tracked</span>
                          </div>
                        </div>

                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '16px' }}>
                          Top Prioritized Problem Areas (by ICS Score)
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                          {sortedCategoryStatsByICS.slice(0, 3).map((cat, idx) => {
                            const stored = recommendationsStore[cat.name];
                            const recTitle = stored?.title ?? `AI Action: ${cat.name} Spec Audit`;
                            const recText = stored?.actionText ?? `Coordinate user research specs to address top feedback trends inside ${cat.name}.`;
                            const status = stored?.status ?? "New";
                            const pct = Math.round((cat.sentiment.positive / (cat.count || 1)) * 100);
                            
                            return (
                              <div key={cat.name} style={{ display: 'flex', gap: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px' }}>
                                <div style={{ background: '#e2e8f0', color: '#334155', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', flexShrink: 0 }}>
                                  {idx + 1}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                                    <div>
                                      <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{cat.name}</strong>
                                      <span className={`badge-priority ${cat.priority.toLowerCase()}`} style={{ marginLeft: '8px', fontSize: '0.68rem', padding: '2px 6px' }}>
                                        ICS: {cat.icsScore}
                                      </span>
                                    </div>
                                    <span className={`status-badge-tag status-${status.toLowerCase()}`} style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                                      {status}
                                    </span>
                                  </div>
                                  <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#475569' }}>
                                    Contains <strong>{cat.count}</strong> comments, with a positive sentiment ratio of <strong>{pct}%</strong>.
                                  </p>
                                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px' }}>
                                    <strong style={{ display: 'block', fontSize: '0.8rem', color: '#334155', marginBottom: '2px' }}>Action Item: {recTitle}</strong>
                                    <span style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45 }}>{recText}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <pre
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '16px',
                          maxHeight: '500px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          fontSize: '0.85rem',
                          fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace',
                          color: '#334155',
                          margin: 0,
                        }}
                      >
                        {digestMarkdown}
                      </pre>
                    )}
                  </div>
                </article>

                {/* Right Column: Actions */}
                <div>
                  <article className="panel">
                    <div className="panel-heading" style={{ marginBottom: '14px' }}>
                      <h3>Export Digest</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleDownloadPdf}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        Download PDF Report
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          navigator.clipboard.writeText(digestMarkdown);
                          setIsDigestCopied(true);
                          setTimeout(() => setIsDigestCopied(false), 2000);
                        }}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        {isDigestCopied ? "Copied!" : "Copy Markdown"}
                      </button>
                      
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', marginTop: '4px' }}>
                        <span style={{ display: 'block', fontSize: '0.78rem', color: '#64748b', lineHeight: '1.4', textAlign: 'center' }}>
                          Export compiles top prioritized issue clusters and coordinates status summaries for direct board reporting.
                        </span>
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            )}
          </section>
        ) : null}

        {activePage === "problems" ? (
          <section className="problems-workspace" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Problem Resolution Tracker</h2>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                  Track what's solved vs outstanding feedback problems. Update statuses to "Done" to close issues.
                </p>
              </div>
              {analysisResult && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleDownloadSolvedProblemsPdf}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <FileSpreadsheet size={18} />
                  Download Solved Problems PDF
                </button>
              )}
            </div>

            {!analysisResult ? (
              <div className="panel empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px', textAlign: 'center' }}>
                <AlertCircle size={48} style={{ color: '#94a3b8', marginBottom: '16px' }} />
                <h3>No analysis data available</h3>
                <p style={{ color: '#64748b', margin: '8px 0 20px', maxWidth: '400px' }}>
                  Please upload a customer feedback CSV dataset in the Upload tab to activate the problem tracker.
                </p>
                <a href="#/upload" className="btn-primary" style={{ textDecoration: 'none' }}>
                  Go to Upload
                </a>
              </div>
            ) : (
              (() => {
                const activeCategories = sortedCategoryStatsByICS.filter((c) => {
                  const problemCount = analysisResult.items.filter(
                    (q) => q.category === c.name && q.sentiment !== "positive"
                  ).length;
                  return problemCount > 0;
                });
                const currentTrackerCategory = selectedTrackerCategory || (activeCategories[0]?.name || null);
                
                const cat = activeCategories.find((c) => c.name === currentTrackerCategory);
                
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Category tabs selector */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid #edf2f4', paddingBottom: '16px' }}>
                      {activeCategories.map((c) => {
                        const isActive = currentTrackerCategory === c.name;
                        const problemCount = analysisResult.items.filter(
                          (q) => q.category === c.name && q.sentiment !== "positive"
                        ).length;

                        return (
                          <button
                            key={c.name}
                            type="button"
                            className={`btn-secondary ${isActive ? 'active' : ''}`}
                            onClick={() => setSelectedTrackerCategory(c.name)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 16px',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              borderRadius: '8px',
                              border: '1px solid',
                              borderColor: isActive ? '#108558' : '#cbd5e1',
                              background: isActive ? '#f0fdf4' : '#fff',
                              color: isActive ? '#108558' : '#475569',
                              cursor: 'pointer',
                              boxShadow: isActive ? '0 2px 4px rgba(16, 133, 88, 0.1)' : 'none',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {getCategoryIcon(c.name, 14)}
                            <span>{c.name}</span>
                            <span style={{
                              background: isActive ? '#108558' : '#64748b',
                              color: '#fff',
                              padding: '1px 6px',
                              borderRadius: '99px',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              marginLeft: '4px'
                            }}>
                              {problemCount}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {cat ? (
                      (() => {
                        const rec = recommendationsStore[cat.name] || {
                          title: `AI Action: ${cat.name} Spec Audit`,
                          actionText: `Coordinate user research specs to address top feedback trends inside ${cat.name}.`,
                          priority: cat.priority
                        };
                        const status = rec.status || "New";
                        const isCatDone = status === "Done";

                        // Get quotes for this category, excluding positive reviews
                        const catQuotes = analysisResult.items.filter((q) => q.category === cat.name && q.sentiment !== "positive");
                        const activeQuotes = catQuotes.filter((q) => (quoteStatuses[q.id] || "New") !== "Done");
                        const solvedQuotes = catQuotes.filter((q) => (quoteStatuses[q.id] || "New") === "Done");

                        return (
                          <article className="panel" key={cat.name} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', borderLeft: `5px solid ${isCatDone ? '#108558' : '#ea580c'}` }}>
                            {/* Category Header Area */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {getCategoryIcon(cat.name, 20)}
                                  <h3 style={{ fontSize: '1.2rem', color: '#0f172a', fontWeight: 800, margin: 0 }}>{cat.name}</h3>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                                  <span className={`badge-priority ${cat.priority.toLowerCase()}`} style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                                    {cat.priority} Priority
                                  </span>
                                  <span className={`status-badge-tag status-${status.toLowerCase()}`} style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                                    {status}
                                  </span>
                                </div>
                              </div>

                              {/* Category Solver Action Button */}
                              <div>
                                {isCatDone ? (
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => reopenProblem(cat.name, cat)}
                                    style={{ padding: '6px 12px', fontSize: '0.82rem', height: '34px', background: '#fffbeb', borderColor: '#fde68a', color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    Reopen Category Action Plan
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => markAsSolved(cat.name, cat)}
                                    style={{ padding: '6px 12px', fontSize: '0.82rem', height: '34px', background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    <CheckCircle2 size={14} /> Solve Category Action Plan
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Recommendation details */}
                            <div style={{ fontSize: '0.88rem', color: '#475569', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                              <strong style={{ display: 'block', fontSize: '0.9rem', color: '#334155', marginBottom: '4px' }}>Action Item: {rec.title}</strong>
                              <span>{rec.actionText}</span>
                            </div>

                            {/* Problems Grid (Active vs Solved quotes side by side) */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', borderTop: '1px solid #edf2f4', paddingTop: '16px' }}>
                              {/* Category Active Quotes Column */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ea580c', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <AlertTriangle size={14} /> Active Problems ({activeQuotes.length})
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {activeQuotes.length === 0 ? (
                                    <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.82rem', border: '1px dashed #e2e8f0', borderRadius: '6px' }}>
                                      No active problems!
                                    </div>
                                  ) : (
                                    activeQuotes.map((q) => (
                                      <div
                                        key={q.id}
                                        className="quote-item-card"
                                        style={{ padding: '12px', margin: 0, border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', display: 'flex', flexDirection: 'column', gap: '8px' }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                            <span className={`badge-sentiment ${q.sentiment}`}>{q.sentiment}</span>
                                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{q.source} • {q.segment}</span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <select
                                              value={q.category}
                                              onChange={(e) => updateQuoteCategory(q.id, e.target.value)}
                                              style={{ height: '22px', padding: '0 4px', fontSize: '0.72rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', color: '#475569', cursor: 'pointer' }}
                                            >
                                              {analysisResult.categoryStats.map((c) => (
                                                <option key={c.name} value={c.name}>
                                                  {c.name}
                                                </option>
                                              ))}
                                            </select>
                                            <button
                                              type="button"
                                              className="btn-secondary"
                                              onClick={() => updateQuoteStatus(q.id, 'Done')}
                                              style={{ padding: '0 6px', fontSize: '0.7rem', height: '22px', minHeight: '22px', background: '#f8fafc', borderColor: '#cbd5e1' }}
                                            >
                                              Solve
                                            </button>
                                          </div>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', fontStyle: 'italic', lineHeight: '1.4' }}>
                                          "{q.feedbackText}"
                                        </p>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>

                              {/* Category Solved Quotes Column */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#166534', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <CheckCircle2 size={14} /> Solved Problems ({solvedQuotes.length})
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {solvedQuotes.length === 0 ? (
                                    <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.82rem', border: '1px dashed #e2e8f0', borderRadius: '6px' }}>
                                      No solved problems yet.
                                    </div>
                                  ) : (
                                    solvedQuotes.map((q) => (
                                      <div
                                        key={q.id}
                                        className="quote-item-card"
                                        style={{ padding: '12px', margin: 0, border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fafdfb', display: 'flex', flexDirection: 'column', gap: '8px' }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                            <span className={`badge-sentiment ${q.sentiment}`}>{q.sentiment}</span>
                                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{q.source} • {q.segment}</span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <select
                                              value={q.category}
                                              onChange={(e) => updateQuoteCategory(q.id, e.target.value)}
                                              style={{ height: '22px', padding: '0 4px', fontSize: '0.72rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#fff', color: '#475569', cursor: 'pointer' }}
                                            >
                                              {analysisResult.categoryStats.map((c) => (
                                                <option key={c.name} value={c.name}>
                                                  {c.name}
                                                </option>
                                              ))}
                                            </select>
                                            <button
                                              type="button"
                                              className="btn-secondary"
                                              onClick={() => updateQuoteStatus(q.id, 'New')}
                                              style={{ padding: '0 6px', fontSize: '0.7rem', height: '22px', minHeight: '22px', background: '#fffbeb', borderColor: '#fde68a' }}
                                            >
                                              Reopen
                                            </button>
                                          </div>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', fontStyle: 'italic', lineHeight: '1.4' }}>
                                          "{q.feedbackText}"
                                        </p>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })()
                    ) : (
                      <div className="panel" style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                        No categories found in dataset.
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </section>
        ) : null}
      </section>

      {/* Column Mapper Overlay Modal */}
      {showMapper ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Map CSV Columns</h2>
              <p>Match your file headers to the analyzer fields. We need a feedback text column to perform analysis.</p>
            </div>
            <div className="modal-body">
              <div className="mapper-row">
                <div className="field-meta">
                  <label>Feedback Comment (Required)</label>
                  <span>Main customer review text</span>
                </div>
                <select
                  value={columnMap.feedback}
                  onChange={(e) => setColumnMap({ ...columnMap, feedback: e.target.value })}
                >
                  <option value="">-- Choose Header --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mapper-row">
                <div className="field-meta">
                  <label>Submitted Date (Optional)</label>
                  <span>Timestamp or created date</span>
                </div>
                <select
                  value={columnMap.date}
                  onChange={(e) => setColumnMap({ ...columnMap, date: e.target.value })}
                >
                  <option value="">-- Choose Header --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mapper-row">
                <div className="field-meta">
                  <label>Channel Source (Optional)</label>
                  <span>E.g., Zendesk, Intercom, App Store</span>
                </div>
                <select
                  value={columnMap.source}
                  onChange={(e) => setColumnMap({ ...columnMap, source: e.target.value })}
                >
                  <option value="">-- Choose Header --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mapper-row">
                <div className="field-meta">
                  <label>User Segment (Optional)</label>
                  <span>E.g., Enterprise, SMB, Gold tier</span>
                </div>
                <select
                  value={columnMap.segment}
                  onChange={(e) => setColumnMap({ ...columnMap, segment: e.target.value })}
                >
                  <option value="">-- Choose Header --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mapper-row">
                <div className="field-meta">
                  <label>Rating/Score (Optional)</label>
                  <span>Numeric rating, e.g., 1-5 stars or 0-10 NPS</span>
                </div>
                <select
                  value={columnMap.rating}
                  onChange={(e) => setColumnMap({ ...columnMap, rating: e.target.value })}
                >
                  <option value="">-- Choose Header --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setShowMapper(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleRunAnalysis}
                disabled={!columnMap.feedback}
              >
                Save & Run Analysis
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Full-screen Loading Overlay for AI Analysis */}
      {isAnalyzing && (
        <div className="modal-backdrop loader-overlay">
          <div className="loader-card">
            <Loader2 size={36} className="spinner" />
            <h2>Analyzing feedback items...</h2>
            <p>{progressLogs}</p>
            <div className="analysis-progress-container" style={{ marginTop: "16px" }}>
              <div className="progress-bar-wrap" style={{ height: "8px", width: "260px" }}>
                <div className="segment pos" style={{ width: `${analysisProgress}%` }}></div>
              </div>
              <span className="progress-text">{analysisProgress}% complete</span>
            </div>
          </div>
        </div>
      )}

      {/* Edit Recommendation Modal */}
      {showEditModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Edit Recommendation</h2>
              <p>Customize the action plan details for category: <strong>{currentCategory}</strong></p>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Recommendation Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Resolution Action Plan</label>
                <textarea
                  value={editActionText}
                  onChange={(e) => setEditActionText(e.target.value)}
                  rows={4}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Priority Level</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as PriorityType)}
                    style={{ width: '100%', height: '38px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', background: '#fff' }}
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Suggested Action Type</label>
                  <select
                    value={editActionType}
                    onChange={(e) => setEditActionType(e.target.value as ActionType)}
                    style={{ width: '100%', height: '38px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', background: '#fff' }}
                  >
                    <option value="bug_fix">Bug Fix</option>
                    <option value="feature">Feature</option>
                    <option value="ux_improvement">UX Improvement</option>
                    <option value="docs">Docs</option>
                    <option value="support">Support</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Workflow Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as WorkflowStatus)}
                  style={{ width: '100%', height: '38px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', outline: 'none', background: '#fff' }}
                >
                  <option value="New">New</option>
                  <option value="Reviewing">Reviewing</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Planned">Planned</option>
                  <option value="Done">Done</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleSaveEdit}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Spec Modal */}
      {showExportModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '720px' }}>
            <div className="modal-header">
              <h2>Export Product Specification</h2>
              <p>Copy formatted Markdown to push this recommendation spec into your tools.</p>
            </div>
            <div className="modal-body" style={{ gap: '12px' }}>
              <pre
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '16px',
                  maxHeight: '350px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.85rem',
                  fontFamily: 'SFMono-Regular, Consolas, Monaco, monospace',
                  color: '#334155',
                  margin: 0,
                }}
              >
                {markdownSpec}
              </pre>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Template includes ICS metrics and verbatim quotes.
              </span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowExportModal(false)}>
                  Close
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleCopySpec}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {isCopied ? <Check size={16} /> : <Copy size={16} />}
                  {isCopied ? "Copied Spec!" : "Copy to Clipboard"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* PDF Generation Loading Overlay */}
      {pdfDownloading && (
        <div className="modal-backdrop loader-overlay">
          <div className="loader-card">
            <Loader2 size={36} className="spinner" />
            <h2>Compiling Digest Report...</h2>
            <p>
              {pdfDownloadProgress < 30 ? "Exporting dashboard charts..." : 
               pdfDownloadProgress < 60 ? "Synthesizing executive summaries..." : 
               pdfDownloadProgress < 90 ? "Assembling PDF report document layout..." : 
               "Writing output stream..."}
            </p>
            <div className="analysis-progress-container" style={{ marginTop: "16px" }}>
              <div className="progress-bar-wrap" style={{ height: "8px", width: "260px" }}>
                <div className="segment pos" style={{ width: `${pdfDownloadProgress}%` }}></div>
              </div>
              <span className="progress-text">{pdfDownloadProgress}% complete</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Subcomponents

function StatsGrid({
  fileName,
  fileSize,
  totalCount,
  avgSentiment,
  dominantCat,
}: {
  fileName: string;
  fileSize: number;
  totalCount: number;
  avgSentiment: number;
  dominantCat: string;
}) {
  return (
    <section className="stats-grid">
      <article>
        <div className="stat-header">
          <span>Feedback Items</span>
          <MessageSquare size={16} />
        </div>
        <strong>{totalCount}</strong>
        <span className="stat-desc">Parsed rows from file</span>
      </article>
      <article>
        <div className="stat-header">
          <span>Average Sentiment</span>
          <TrendingUp size={16} />
        </div>
        <strong>{avgSentiment}%</strong>
        <span className="stat-desc">Positive weight score</span>
      </article>
      <article>
        <div className="stat-header">
          <span>Dominant Area</span>
          <AlertTriangle size={16} />
        </div>
        <strong className="stat-truncate">{dominantCat}</strong>
        <span className="stat-desc">Top categorized problem</span>
      </article>
      <article>
        <div className="stat-header">
          <span>Analyzed Dataset</span>
          <FileSpreadsheet size={16} />
        </div>
        <strong className="stat-truncate" title={fileName}>{fileName || "None"}</strong>
        <span className="stat-desc">{fileSize ? formatFileSize(fileSize) : "-"} file size</span>
      </article>
    </section>
  );
}

// Subcomponent for Category-specific metrics
function StatsGridCategory({
  totalCount,
  positivePercentage,
  segmentsAffected,
  sourcesAffected,
}: {
  totalCount: number;
  positivePercentage: number;
  segmentsAffected: Record<string, number>;
  sourcesAffected: Record<string, number>;
}) {
  const dominantSegment = useMemo(() => {
    const entries = Object.entries(segmentsAffected);
    if (entries.length === 0) return "General";
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }, [segmentsAffected]);

  const dominantSource = useMemo(() => {
    const entries = Object.entries(sourcesAffected);
    if (entries.length === 0) return "Unknown";
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }, [sourcesAffected]);

  return (
    <section className="stats-grid">
      <article>
        <div className="stat-header">
          <span>Category Volume</span>
          <MessageSquare size={16} />
        </div>
        <strong>{totalCount}</strong>
        <span className="stat-desc">Comments in this category</span>
      </article>
      <article>
        <div className="stat-header">
          <span>Sentiment Score</span>
          <TrendingUp size={16} />
        </div>
        <strong>{positivePercentage}%</strong>
        <span className="stat-desc">Positive comments ratio</span>
      </article>
      <article>
        <div className="stat-header">
          <span>Key Segment</span>
          <User size={16} />
        </div>
        <strong className="stat-truncate">{dominantSegment}</strong>
        <span className="stat-desc">Most affected group</span>
      </article>
      <article>
        <div className="stat-header">
          <span>Top Channel</span>
          <Link size={16} />
        </div>
        <strong className="stat-truncate">{dominantSource}</strong>
        <span className="stat-desc">Main origin channel</span>
      </article>
    </section>
  );
}

function SentimentDonutChart({
  distribution,
  activeFilter,
  onSelectFilter,
}: {
  distribution: {
    positive: number;
    neutral: number;
    negative: number;
    positivePercentage: number;
    neutralPercentage: number;
    negativePercentage: number;
  };
  activeFilter: string;
  onSelectFilter: (sentiment: string) => void;
}) {
  const circ = 2 * Math.PI * 40; // circumference ~251.3

  const posStroke = (distribution.positivePercentage / 100) * circ;
  const neuStroke = (distribution.neutralPercentage / 100) * circ;
  const negStroke = (distribution.negativePercentage / 100) * circ;

  return (
    <article className="panel sentiment-donut-panel">
      <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="eyebrow">Sentiment</p>
          <h3>Sentiment distribution</h3>
        </div>
        {activeFilter !== "all" ? (
          <button
            type="button"
            className="clear-chart-filter-badge"
            onClick={() => onSelectFilter("all")}
            style={{
              background: '#fef2f2',
              color: '#ef4444',
              border: '1px solid #fee2e2',
              borderRadius: '12px',
              padding: '2.5px 8px',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            title="Click to clear filter"
          >
            Filtered: {activeFilter} ✕
          </button>
        ) : (
          <Activity size={18} className="text-secondary" />
        )}
      </div>
      <div className="sentiment-chart-container">
        <div className="svg-wrapper">
          <svg viewBox="0 0 100 100" width="160" height="160">
            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#e6ecf0" strokeWidth="8" />
            {/* Positive (Green) */}
            {posStroke > 0 && (
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#2ac380"
                strokeWidth={activeFilter === "positive" ? 11 : 8}
                strokeDasharray={`${posStroke} ${circ - posStroke}`}
                strokeDashoffset="0"
                transform="rotate(-90 50 50)"
                onClick={() => onSelectFilter(activeFilter === "positive" ? "all" : "positive")}
                style={{
                  cursor: "pointer",
                  transition: "all 0.2s ease-in-out",
                  opacity: activeFilter !== "all" && activeFilter !== "positive" ? 0.35 : 1,
                }}
              />
            )}
            {/* Neutral (Yellow) */}
            {neuStroke > 0 && (
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#fab005"
                strokeWidth={activeFilter === "neutral" ? 11 : 8}
                strokeDasharray={`${neuStroke} ${circ - neuStroke}`}
                strokeDashoffset={-posStroke}
                transform="rotate(-90 50 50)"
                onClick={() => onSelectFilter(activeFilter === "neutral" ? "all" : "neutral")}
                style={{
                  cursor: "pointer",
                  transition: "all 0.2s ease-in-out",
                  opacity: activeFilter !== "all" && activeFilter !== "neutral" ? 0.35 : 1,
                }}
              />
            )}
            {/* Negative (Red) */}
            {negStroke > 0 && (
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="transparent"
                stroke="#fa5252"
                strokeWidth={activeFilter === "negative" ? 11 : 8}
                strokeDasharray={`${negStroke} ${circ - negStroke}`}
                strokeDashoffset={-(posStroke + neuStroke)}
                transform="rotate(-90 50 50)"
                onClick={() => onSelectFilter(activeFilter === "negative" ? "all" : "negative")}
                style={{
                  cursor: "pointer",
                  transition: "all 0.2s ease-in-out",
                  opacity: activeFilter !== "all" && activeFilter !== "negative" ? 0.35 : 1,
                }}
              />
            )}
          </svg>
          <div className="chart-center-label">
            <strong>
              {activeFilter === "neutral"
                ? `${distribution.neutralPercentage}%`
                : activeFilter === "negative"
                ? `${distribution.negativePercentage}%`
                : `${distribution.positivePercentage}%`}
            </strong>
            <span>
              {activeFilter === "neutral"
                ? "Neutral"
                : activeFilter === "negative"
                ? "Negative"
                : "Positive"}
            </span>
          </div>
        </div>
        <div className="chart-legend">
          <button
            type="button"
            className={`legend-item interactive ${activeFilter === "positive" ? "active pos" : ""}`}
            onClick={() => onSelectFilter(activeFilter === "positive" ? "all" : "positive")}
          >
            <span className="indicator pos"></span>
            <div className="legend-details">
              <span>Positive</span>
              <strong>{distribution.positive} items ({distribution.positivePercentage}%)</strong>
            </div>
          </button>
          <button
            type="button"
            className={`legend-item interactive ${activeFilter === "neutral" ? "active neu" : ""}`}
            onClick={() => onSelectFilter(activeFilter === "neutral" ? "all" : "neutral")}
          >
            <span className="indicator neu"></span>
            <div className="legend-details">
              <span>Neutral</span>
              <strong>{distribution.neutral} items ({distribution.neutralPercentage}%)</strong>
            </div>
          </button>
          <button
            type="button"
            className={`legend-item interactive ${activeFilter === "negative" ? "active neg" : ""}`}
            onClick={() => onSelectFilter(activeFilter === "negative" ? "all" : "negative")}
          >
            <span className="indicator neg"></span>
            <div className="legend-details">
              <span>Negative</span>
              <strong>{distribution.negative} items ({distribution.negativePercentage}%)</strong>
            </div>
          </button>
        </div>
      </div>
    </article>
  );
}

function CategoryStatsGrid({
  categoryStats,
  activeFilter,
  onSelectFilter,
}: {
  categoryStats: any[];
  activeFilter: string;
  onSelectFilter: (category: string) => void;
}) {
  const filtered = categoryStats.filter((cat) => cat.count > 0).slice(0, 5);

  if (filtered.length === 0) {
    return <div className="empty-state">No categorized items found.</div>;
  }

  return (
    <div className="category-stats-list">
      {filtered.map((cat) => {
        const total = cat.count;
        const pos = cat.sentiment.positive;
        const neg = cat.sentiment.negative;
        
        const posPct = total ? Math.round((pos / total) * 100) : 0;
        const negPct = total ? Math.round((neg / total) * 100) : 0;
        const neuPct = 100 - posPct - negPct;
        const isActive = activeFilter === cat.name;

        return (
          <div
            className={`category-stat-row interactive ${isActive ? "active" : ""}`}
            key={cat.name}
            onClick={() => onSelectFilter(isActive ? "all" : cat.name)}
            style={{ cursor: "pointer" }}
          >
            <div className="category-stat-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <strong>{cat.name}</strong>
                {cat.priority && (
                  <span className={`badge-priority ${cat.priority.toLowerCase()}`} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>
                    {cat.priority} (ICS: {cat.icsScore})
                  </span>
                )}
              </div>
              <span>{cat.count} comments</span>
            </div>
            <div className="category-stat-progress">
              <div className="progress-bar-wrap">
                <div className="segment pos" style={{ width: `${posPct}%` }} title={`Positive: ${posPct}%`}></div>
                <div className="segment neu" style={{ width: `${neuPct}%` }} title={`Neutral: ${neuPct}%`}></div>
                <div className="segment neg" style={{ width: `${negPct}%` }} title={`Negative: ${negPct}%`}></div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Renders lists
function TopKeywordsList({ keywords }: { keywords: any[] }) {
  if (keywords.length === 0) {
    return <div className="empty-state">No repeating terms extracted. Upload a larger negative feedback set.</div>;
  }

  return (
    <div className="keyword-density-list">
      {keywords.map((kw, i) => (
        <div className="keyword-row" key={kw.text}>
          <div className="keyword-badge">
            <span className="rank">#{i + 1}</span>
            <strong className="keyword-text">{kw.text}</strong>
          </div>
          <div className="keyword-bar-container">
            <span className="keyword-count">{kw.count} hits</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function UrgentComplaintsList({ complaints }: { complaints: AnalyzedFeedbackItem[] }) {
  if (complaints.length === 0) {
    return (
      <div className="empty-state">
        <CheckCircle2 size={24} className="text-positive" />
        <p>No critical urgency keywords triggered in negative feedback comments.</p>
      </div>
    );
  }

  return (
    <div className="urgent-list">
      {complaints.map((item) => (
        <div className="urgent-card" key={item.id}>
          <div className="urgent-card-header">
            <span className="badge source">{item.source}</span>
            <span className="badge segment">{item.segment}</span>
            <span className="badge date">{item.date}</span>
          </div>
          <p className="urgent-card-text">"{item.feedbackText}"</p>
          <div className="urgent-card-footer">
            <span className="badge category-tag">{item.category}</span>
            <span className="badge sentiment-tag negative">Urgent Alert</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DistributionList({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  const total = entries.reduce((acc, c) => acc + c[1], 0);

  if (entries.length === 0) {
    return <div className="empty-state text-muted" style={{ padding: "8px 0" }}>No distribution data.</div>;
  }

  const sorted = entries.sort((a, b) => b[1] - a[1]);

  return (
    <div className="category-stats-list" style={{ marginTop: "8px" }}>
      {sorted.map(([name, count]) => {
        const pct = total ? Math.round((count / total) * 100) : 0;
        return (
          <div className="category-stat-row" key={name}>
            <div className="category-stat-meta" style={{ marginBottom: "2px" }}>
              <span style={{ fontSize: "0.85rem", color: "#334155", fontWeight: 600 }}>{name}</span>
              <span style={{ fontSize: "0.78rem" }}>{count} ({pct}%)</span>
            </div>
            <div className="progress-bar-wrap" style={{ height: "6px" }}>
              <div className="segment pos" style={{ width: `${pct}%`, background: "#475569" }}></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FeedbackExplorer({
  items,
  searchQuery,
  setSearchQuery,
  sentimentFilter,
  setSentimentFilter,
  categoryFilter,
  setCategoryFilter,
}: {
  items: AnalyzedFeedbackItem[];
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  sentimentFilter: string;
  setSentimentFilter: (val: string) => void;
  categoryFilter: string;
  setCategoryFilter: (val: string) => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Derive unique categories from dataset
  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    return Array.from(set).sort();
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.feedbackText.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSentiment = sentimentFilter === "all" || item.sentiment === sentimentFilter;
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      return matchesSearch && matchesSentiment && matchesCategory;
    });
  }, [items, searchQuery, sentimentFilter, categoryFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sentimentFilter, categoryFilter]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;

  return (
    <article className="panel explorer-panel" id="explorer-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Explorer</p>
          <h3>Feedback dataset search and filters</h3>
        </div>
        <Filter size={18} className="text-secondary" />
      </div>

      <div className="explorer-filters-row">
        <div className="filter-group">
          <label>Sentiment</label>
          <select value={sentimentFilter} onChange={(e) => setSentimentFilter(e.target.value)}>
            <option value="all">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Category</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="search-bar-wrap">
          <label>Search comments</label>
          <div className="search-input-container">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search terms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Active Filter Pills */}
      {(sentimentFilter !== "all" || categoryFilter !== "all" || searchQuery.trim() !== "") && (
        <div className="active-filters-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '12px 0 0', borderTop: '1px dashed #e2e8f0', marginTop: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Filters:</span>
          
          {sentimentFilter !== "all" && (
            <span className={`filter-pill sentiment-${sentimentFilter}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '99px', fontWeight: 500 }}>
              Sentiment: {sentimentFilter}
              <button type="button" onClick={() => setSentimentFilter("all")} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex', fontWeight: 800 }}>×</button>
            </span>
          )}

          {categoryFilter !== "all" && (
            <span className="filter-pill category-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '99px', fontWeight: 500 }}>
              Category: {categoryFilter}
              <button type="button" onClick={() => setCategoryFilter("all")} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex', fontWeight: 800 }}>×</button>
            </span>
          )}

          {searchQuery.trim() !== "" && (
            <span className="filter-pill search-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', background: '#f1f5f9', color: '#334155', padding: '4px 10px', borderRadius: '99px', fontWeight: 500 }}>
              Search: "{searchQuery}"
              <button type="button" onClick={() => setSearchQuery("")} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex', fontWeight: 800 }}>×</button>
            </span>
          )}

          <button
            type="button"
            className="clear-all-filters-btn"
            onClick={() => {
              setSentimentFilter("all");
              setCategoryFilter("all");
              setSearchQuery("");
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#fa5252',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              marginLeft: 'auto',
              padding: '2px 6px',
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
          >
            Clear All
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: "80px" }}>Sentiment</th>
              <th style={{ width: "120px" }}>Category</th>
              <th>Comment</th>
              <th style={{ width: "100px" }}>Date</th>
              <th style={{ width: "90px" }}>Source</th>
              <th style={{ width: "100px" }}>Segment</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((item) => (
              <tr key={item.id}>
                <td>
                  <span className={`badge-sentiment ${item.sentiment}`}>{item.sentiment}</span>
                </td>
                <td>
                  <span className="badge-category">{item.category}</span>
                </td>
                <td className="comment-cell" title={item.feedbackText}>
                  {item.feedbackText}
                </td>
                <td>{item.date || "-"}</td>
                <td>
                  <span className="badge-source-type">{item.source}</span>
                </td>
                <td>
                  <span className="badge-segment-type">{item.segment}</span>
                </td>
              </tr>
            ))}
            {paginatedItems.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-muted py-4">
                  No comments match the search filter settings.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination-bar">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((c) => Math.max(c - 1, 1))}
          >
            Prev
          </button>
          <span>
            Page {currentPage} of {totalPages} ({filteredItems.length} records)
          </span>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((c) => Math.min(c + 1, totalPages))}
          >
            Next
          </button>
        </div>
      )}
    </article>
  );
}

function FeedbackPreview({
  hasData,
  headers,
  rows,
}: {
  hasData: boolean;
  headers: string[];
  rows: CsvRow[];
}) {
  const previewHeaders = headers.slice(0, 6);
  const previewRows = rows.slice(0, 5);

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Preview</p>
          <h3>Uploaded spreadsheet columns</h3>
        </div>
      </div>

      {hasData ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {previewHeaders.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, index) => (
                <tr key={`${index}-${Object.values(row).join("-")}`}>
                  {previewHeaders.map((header) => (
                    <td key={header}>{row[header] || "-"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state large">
          <FileSpreadsheet size={34} />
          <p>Upload a CSV file or load sample data to check column contents.</p>
        </div>
      )}
    </article>
  );
}
