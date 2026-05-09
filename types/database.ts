// Vivie Dashboard - Supabase 型定義
// supabase/migrations/20260509000001_init.sql と同期

export type StaffRole = 'admin' | 'manager' | 'staff';
export type MemberSource = 'square' | 'manual';
export type MemberStatus = 'active' | 'paused' | 'cancelled' | 'lead';
export type CashbookType = 'income' | 'expense' | 'adjustment';
export type CashbookSource = 'cash' | 'square' | 'bank' | 'online' | 'other';
export type AttendanceKind = 'clock_in' | 'clock_out' | 'break_start' | 'break_end';

export interface Store {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  square_location_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Staff {
  id: string;
  display_name: string;
  email: string;
  role: StaffRole;
  primary_store_id: string | null;
  daily_report_token: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Member {
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
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: string;
  square_plan_id: string | null;
  name: string;
  monthly_price: number;
  monthly_visit_limit: number | null;
  carryover_months: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemberSubscription {
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
}

export interface Visit {
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
  created_at: string;
}

export interface CounselingRecord {
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
  created_at: string;
}

export interface CashbookEntry {
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
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyReport {
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
  existing_treatment_count: number;
  repeat_count: number;
  total_sales: number;
  discount_total: number;
  highlights: string | null;
  challenges: string | null;
  next_actions: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceLog {
  id: string;
  staff_id: string;
  store_id: string;
  kind: AttendanceKind;
  clocked_at: string;
  latitude: number;
  longitude: number;
  distance_meters: number;
  device_info: Record<string, unknown> | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      stores: {
        Row: Store;
        Insert: Partial<Store> & Pick<Store, 'name'>;
        Update: Partial<Store>;
      };
      staff: {
        Row: Staff;
        Insert: Partial<Staff> & Pick<Staff, 'id' | 'display_name' | 'email'>;
        Update: Partial<Staff>;
      };
      staff_stores: {
        Row: { staff_id: string; store_id: string };
        Insert: { staff_id: string; store_id: string };
        Update: Partial<{ staff_id: string; store_id: string }>;
      };
      members: {
        Row: Member;
        Insert: Partial<Member> & Pick<Member, 'full_name'>;
        Update: Partial<Member>;
      };
      subscription_plans: {
        Row: SubscriptionPlan;
        Insert: Partial<SubscriptionPlan> & Pick<SubscriptionPlan, 'name'>;
        Update: Partial<SubscriptionPlan>;
      };
      member_subscriptions: {
        Row: MemberSubscription;
        Insert: Partial<MemberSubscription> & Pick<MemberSubscription, 'member_id' | 'status'>;
        Update: Partial<MemberSubscription>;
      };
      visits: {
        Row: Visit;
        Insert: Partial<Visit> & Pick<Visit, 'store_id' | 'visit_date'>;
        Update: Partial<Visit>;
      };
      counseling_records: {
        Row: CounselingRecord;
        Insert: Partial<CounselingRecord> & Pick<CounselingRecord, 'full_name' | 'phone'>;
        Update: Partial<CounselingRecord>;
      };
      cashbook_entries: {
        Row: CashbookEntry;
        Insert: Partial<CashbookEntry> &
          Pick<CashbookEntry, 'store_id' | 'entry_date' | 'entry_type' | 'category' | 'amount'>;
        Update: Partial<CashbookEntry>;
      };
      daily_reports: {
        Row: DailyReport;
        Insert: Partial<DailyReport> &
          Pick<DailyReport, 'store_id' | 'staff_id' | 'report_date'>;
        Update: Partial<DailyReport>;
      };
      attendance_logs: {
        Row: AttendanceLog;
        Insert: Partial<AttendanceLog> &
          Pick<
            AttendanceLog,
            'staff_id' | 'store_id' | 'kind' | 'latitude' | 'longitude' | 'distance_meters'
          >;
        Update: Partial<AttendanceLog>;
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
  };
}
