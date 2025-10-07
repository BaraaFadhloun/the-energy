export type ChangeType = "increase" | "decrease" | "neutral";

export interface StatCardData {
  title: string;
  value: number | string;
  unit: string;
  change: string;
  change_type: ChangeType;
  trend: string;
}

export interface UsagePoint {
  date: string;
  kwh: number;
}

export interface CostSegment {
  segment: string;
  value: number;
}

export interface SummaryBadge {
  label: string;
  value: string;
}

export interface RecommendationImpact {
  value: string;
  period: string;
}

export interface RecommendationLocalizedText {
  title: string;
  impact: string;
  tips: string[];
}

export interface RecommendationContent {
  en: RecommendationLocalizedText;
  fr: RecommendationLocalizedText;
}

export interface Recommendation {
  category: string;
  impact: RecommendationImpact;
  tips: string[];
  meta?: Record<string, unknown> | null;
  content?: RecommendationContent | null;
}

export interface DailyCostSnapshot {
  date: string;
  kwh: number;
  cost: number;
}

export interface WeekendWeekdayComparison {
  weekend_avg_cost_per_kwh: number;
  weekday_avg_cost_per_kwh: number;
  weekend_avg_daily_cost: number;
  weekday_avg_daily_cost: number;
  weekend_days: number;
  weekday_days: number;
}

export interface QuarterUsageComparison {
  start_label: string;
  start_kwh: number;
  end_label: string;
  end_kwh: number;
  delta_kwh: number;
  delta_percent?: number | null;
}

export interface PeakWindowInsight {
  start_hour: number;
  end_hour: number;
  avg_kwh_per_day: number;
}

export interface SummaryInsights {
  peak_day: DailyCostSnapshot;
  weekend_vs_weekday?: WeekendWeekdayComparison | null;
  top_expensive_days: DailyCostSnapshot[];
  quarter_usage?: QuarterUsageComparison | null;
  peak_window?: PeakWindowInsight | null;
  average_cost_per_kwh: number;
  shift_kwh: number;
  days_covered: number;
  co2_factor: number;
}

export interface AnalyticsSummary {
  stats: StatCardData[];
  usage: UsagePoint[];
  cost_breakdown: CostSegment[];
  badges: SummaryBadge[];
  recommendations: Recommendation[];
  insights?: SummaryInsights | null;
}

export interface ReadingRecord {
  reading_date: string;
  reading_time?: string | null;
  reading_at?: string | null;
  kwh: number;
  cost: number;
}

export interface DatasetRecord {
  id: number;
  original_filename: string;
  uploaded_at: string;
  total_kwh: number;
  total_cost: number;
  total_co2: number;
  row_count: number;
}

export interface DatasetDetail {
  dataset: DatasetRecord;
  summary: AnalyticsSummary;
  readings: ReadingRecord[];
}
