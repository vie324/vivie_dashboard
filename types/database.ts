// Vivie Dashboard - Supabase 型定義
// supabase/migrations/*.sql と同期 (手書き。理想は `supabase gen types typescript`)
//
// 重要: 各テーブルの Row は interface ではなく type で定義する。
// interface は暗黙の index signature を持たないため Supabase の
// `GenericTable extends Record<string, unknown>` 制約を満たせず、
// from('table') の戻り値が never に潰れる。type 別名はこの制約を満たす。

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// jsonb カラム用。実運用ではキーが動的なため緩めに扱う。
type JsonObject = { [key: string]: any };

// =====================================================
// Enums
// =====================================================
export type StaffRole = 'admin' | 'manager' | 'staff' | 'store';
export type MemberSource = 'square' | 'manual';
export type MemberStatus = 'active' | 'paused' | 'cancelled' | 'lead';
export type CashbookType = 'income' | 'expense' | 'adjustment';
export type CashbookSource = 'cash' | 'square' | 'bank' | 'online' | 'other';
// 売上区分 (収入の内訳)。サブスク課金 / 単発 / 回数券 / 物販 / その他。
export type SaleKind = 'subscription' | 'single' | 'ticket' | 'product' | 'other';
export type AttendanceKind = 'clock_in' | 'clock_out' | 'break_start' | 'break_end';

// =====================================================
// Table Row 型
// =====================================================
export type Store = {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  square_location_id: string | null;
  is_active: boolean;
  business_hours: JsonObject | null;
  created_at: string;
  updated_at: string;
};

export type Staff = {
  id: string;
  display_name: string;
  email: string;
  role: StaffRole;
  primary_store_id: string | null;
  daily_report_token: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StaffStore = {
  staff_id: string;
  store_id: string;
};

export type Member = {
  id: string;
  source: MemberSource;
  square_customer_id: string | null;
  full_name: string;
  furigana: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  address: string | null;
  occupation: string | null;
  status: MemberStatus;
  primary_store_id: string | null;
  notes: string | null;
  joined_at: string | null;
  // 獲得媒体 (派生リピート率の集計軸)。counseling_records.acquisition_channel から補完。
  acquisition_channel: string | null;
  line_user_id: string | null;
  line_display_name: string | null;
  line_picture_url: string | null;
  created_at: string;
  updated_at: string;
};

export type SubscriptionPlan = {
  id: string;
  square_plan_id: string | null;
  name: string;
  monthly_price: number;
  // Square の課金周期 (MONTHLY / WEEKLY / ANNUAL など)。MRR の月額換算に使用。
  cadence: string | null;
  monthly_visit_limit: number | null;
  carryover_months: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MemberSubscription = {
  id: string;
  member_id: string;
  plan_id: string | null;
  square_subscription_id: string | null;
  status: string;
  started_at: string | null;
  next_billing_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Visit = {
  id: string;
  member_id: string | null;
  store_id: string;
  staff_id: string | null;
  visit_date: string;
  visit_at: string;
  is_first_visit: boolean;
  menu: string | null;
  amount: number | null;
  notes: string | null;
  // 施術レポートから自動投入された来店行を一意に紐付ける (重複防止)
  treatment_report_id: string | null;
  created_at: string;
};

export type CounselingRecord = {
  id: string;
  store_id: string | null;
  member_id: string | null;
  full_name: string;
  furigana: string | null;
  address: string | null;
  phone: string;
  birth_date: string | null;
  occupation: string | null;
  visit_reasons: string[];
  visit_reason_other: string | null;
  past_treatments: string[];
  switch_reason: string | null;
  switch_reason_other: string | null;
  past_complaints: string[];
  past_complaints_other: string | null;
  skin_concerns: string[];
  face_concerns: string[];
  body_concerns: string[];
  goal_timeline: string | null;
  monthly_budget: string | null;
  agreed_to_terms: boolean;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  internal_notes: string | null;
  // 20260509000010 マーケ・契約分析
  assigned_staff_id: string | null;
  assigned_staff_name: string | null;
  acquisition_channel: string | null;
  closing_status: string | null;
  closing_status_raw: string | null;
  next_reservation_date: string | null;
  no_contract_reason: string | null;
  contract_reason: string | null;
  contract_plan: string | null;
  imported: boolean;
  // 20260509000011 ジオコーディング
  geo_lat: number | null;
  geo_lng: number | null;
  geo_source: string | null;
  geo_attempted_at: string | null;
  geo_error: string | null;
  created_at: string;
};

export type CashbookEntry = {
  id: string;
  store_id: string;
  entry_date: string;
  entry_type: CashbookType;
  source: CashbookSource;
  category: string;
  amount: number;
  description: string | null;
  related_member_id: string | null;
  square_payment_id: string | null;
  // 売上区分とその根拠 (Square サブスク課金の自動判定 / 回数券記帳で利用)
  sale_kind: SaleKind | null;
  square_order_id: string | null;
  square_subscription_id: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyReport = {
  id: string;
  store_id: string;
  staff_id: string;
  report_date: string;
  hpb_new_count: number;
  hpb_contract_count: number;
  meta_new_count: number;
  meta_contract_count: number;
  referral_new_count: number;
  referral_contract_count: number;
  minimo_new_count: number;
  minimo_contract_count: number;
  existing_treatment_count: number;
  repeat_count: number;
  // 媒体別の既存施術件数 / リピート (再来) 件数 — 媒体別リピート率の算出に使用 (任意入力)
  hpb_existing_count: number;
  hpb_repeat_count: number;
  meta_existing_count: number;
  meta_repeat_count: number;
  minimo_existing_count: number;
  minimo_repeat_count: number;
  referral_existing_count: number;
  referral_repeat_count: number;
  total_sales: number;
  discount_total: number;
  highlights: string | null;
  challenges: string | null;
  next_actions: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
};

export type AttendanceLog = {
  id: string;
  staff_id: string;
  store_id: string;
  kind: AttendanceKind;
  clocked_at: string;
  latitude: number;
  longitude: number;
  distance_meters: number;
  device_info: JsonObject | null;
  created_at: string;
};

export type TreatmentReport = {
  id: string;
  member_id: string;
  store_id: string;
  staff_id: string | null;
  treatment_date: string;
  menu: string | null;
  duration_minutes: number | null;
  amount: number | null;
  skin_scores: JsonObject;
  face_scores: JsonObject;
  body_scores: JsonObject;
  before_photo_path: string | null;
  after_photo_path: string | null;
  observations: string | null;
  next_recommendation: string | null;
  is_first_visit: boolean;
  contracted: boolean;
  followup_offer: JsonObject | null;
  line_sent_at: string | null;
  line_request_id: string | null;
  line_send_status: string | null;
  line_send_error: string | null;
  created_at: string;
  updated_at: string;
};

export type LineEvent = {
  id: string;
  event_type: string;
  line_user_id: string | null;
  display_name: string | null;
  picture_url: string | null;
  message_text: string | null;
  raw: JsonObject | null;
  member_id: string | null;
  received_at: string;
};

export type LineMessage = {
  id: string;
  line_user_id: string;
  member_id: string | null;
  direction: 'inbound' | 'outbound';
  message_type: string;
  message_text: string | null;
  content: JsonObject | null;
  line_message_id: string | null;
  sent_by: string | null;
  sent_at: string;
  read_at: string | null;
  created_at: string;
};

export type Tag = {
  id: string;
  name: string;
  color: string;
  created_at: string;
};

export type MemberTag = {
  member_id: string;
  tag_id: string;
  added_at: string;
};

export type LineTemplate = {
  id: string;
  name: string;
  body: string;
  category: string | null;
  shortcut: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CashbookCategory = {
  id: string;
  name: string;
  entry_type: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  details: JsonObject | null;
  created_at: string;
};

export type TreatmentMenu = {
  id: string;
  name: string;
  category: string | null;
  duration_minutes: number | null;
  price: number | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
};

export type LineConversationMeta = {
  line_user_id: string;
  status: string;
  pinned: boolean;
  assignee_id: string | null;
  internal_notes: string | null;
  last_handled_at: string | null;
  last_handled_by: string | null;
  updated_at: string;
};

export type MonthlyGoal = {
  id: string;
  store_id: string | null;
  goal_month: string;
  hpb_new_target: number;
  meta_new_target: number;
  minimo_new_target: number;
  referral_new_target: number;
  contract_target: number;
  sales_target: number;
  repeat_rate_target: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type TicketPlan = {
  id: string;
  name: string;
  total_count: number;
  price: number;
  validity_months: number;
  is_active: boolean;
  display_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Ticket = {
  id: string;
  member_id: string;
  plan_id: string | null;
  store_id: string | null;
  plan_name: string;
  total_count: number;
  used_count: number;
  price: number;
  purchased_at: string;
  expires_at: string;
  status: string;
  notes: string | null;
  sold_by: string | null;
  refunded_at: string | null;
  refunded_by: string | null;
  refund_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type TicketUsage = {
  id: string;
  ticket_id: string;
  used_at: string;
  used_by_staff: string | null;
  treatment_report_id: string | null;
  menu: string | null;
  notes: string | null;
  created_at: string;
};

export type CounselingSettings = {
  id: string;
  disclaimer: string | null;
  updated_by: string | null;
  updated_at: string;
};

// =====================================================
// View Row 型 (読み取り専用)
// =====================================================
export type LineConversation = {
  line_user_id: string;
  member_id: string | null;
  member_name: string | null;
  line_display_name: string | null;
  line_picture_url: string | null;
  last_message: string | null;
  last_message_type: string | null;
  last_direction: string | null;
  last_sent_at: string | null;
  status: string;
  pinned: boolean;
  assignee_id: string | null;
  last_handled_at: string | null;
  unread_count: number | null;
};

export type MemberStats = {
  member_id: string;
  total_visits: number | null;
  last_visit_date: string | null;
  total_spend: number | null;
  active_subscriptions: number | null;
};

export type AttendanceDaily = {
  staff_id: string | null;
  store_id: string | null;
  work_date: string | null;
  clock_in_at: string | null;
  clock_out_at: string | null;
  gross_minutes: number | null;
  break_starts: number | null;
  break_ends: number | null;
};

export type CounselingMarketingSummary = {
  acquisition_channel: string | null;
  total: number | null;
  contracted: number | null;
  contract_rate: number | null;
};

export type CounselingStaffSummary = {
  staff_name: string | null;
  raw_name: string | null;
  total: number | null;
  contracted: number | null;
  contract_rate: number | null;
};

export type TicketOverview = Ticket & {
  member_name: string | null;
  line_user_id: string | null;
  line_picture_url: string | null;
  store_name: string | null;
  remaining_count: number | null;
  days_until_expiry: number | null;
  effective_status: string;
};

// 派生リピート率 (媒体別) — 会員の獲得媒体 × 来店履歴ベースの参考値
export type RepeatRateByMediaDerived = {
  channel: string;
  month: string; // YYYY-MM
  total_visits: number | null;
  first_visits: number | null;
  repeat_visits: number | null;
  repeat_rate: number | null;
};

// =====================================================
// Supabase Database 型
// =====================================================
type TableDef<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type ViewDef<Row> = {
  Row: Row;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      stores: TableDef<Store>;
      staff: TableDef<Staff>;
      staff_stores: TableDef<StaffStore>;
      members: TableDef<Member>;
      subscription_plans: TableDef<SubscriptionPlan>;
      member_subscriptions: TableDef<MemberSubscription>;
      visits: TableDef<Visit>;
      counseling_records: TableDef<CounselingRecord>;
      cashbook_entries: TableDef<CashbookEntry>;
      cashbook_categories: TableDef<CashbookCategory>;
      daily_reports: TableDef<DailyReport>;
      attendance_logs: TableDef<AttendanceLog>;
      treatment_reports: TableDef<TreatmentReport>;
      treatment_menus: TableDef<TreatmentMenu>;
      line_events: TableDef<LineEvent>;
      line_messages: TableDef<LineMessage>;
      line_templates: TableDef<LineTemplate>;
      line_conversation_meta: TableDef<LineConversationMeta>;
      tags: TableDef<Tag>;
      member_tags: TableDef<MemberTag>;
      audit_logs: TableDef<AuditLog>;
      monthly_goals: TableDef<MonthlyGoal>;
      ticket_plans: TableDef<TicketPlan>;
      tickets: TableDef<Ticket>;
      ticket_usages: TableDef<TicketUsage>;
      counseling_settings: TableDef<CounselingSettings>;
    };
    Views: {
      line_conversations: ViewDef<LineConversation>;
      member_stats: ViewDef<MemberStats>;
      attendance_daily: ViewDef<AttendanceDaily>;
      counseling_marketing_summary: ViewDef<CounselingMarketingSummary>;
      counseling_staff_summary: ViewDef<CounselingStaffSummary>;
      ticket_overview: ViewDef<TicketOverview>;
      repeat_rate_by_media_derived: ViewDef<RepeatRateByMediaDerived>;
    };
    Functions: {
      use_ticket: {
        Args: {
          p_ticket_id: string;
          p_staff_id?: string | null;
          p_treatment_report_id?: string | null;
          p_menu?: string | null;
          p_notes?: string | null;
        };
        Returns: Json;
      };
    };
    Enums: {
      staff_role: StaffRole;
      member_source: MemberSource;
      member_status: MemberStatus;
      cashbook_type: CashbookType;
      cashbook_source: CashbookSource;
      attendance_kind: AttendanceKind;
    };
    CompositeTypes: Record<string, never>;
  };
}
