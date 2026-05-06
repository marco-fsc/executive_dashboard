export type ISODateString = string;

export interface Enrollment {
  uid: string;
  Name: string; // Program name
  "Project Start Date": ISODateString;
  "Enrollment Exit Date"?: ISODateString;
  "Project Exit Date"?: ISODateString;
  "Active in Project": "Yes" | "No" | string;
  "Assigned Staff"?: string;
  "Destination Category"?: string;
  Destination?: string;
  "Days in Project"?: number;

  last_service_date?: ISODateString;
  service_count?: number;           // real services only (excludes Attempted Engagement & Appointment Reminders)
  attempted_engagement_count?: number; // rows where client was unavailable (no attendance date)
  appointment_reminder_count?: number; // reminder notes left; have a date but not full service
  last_real_service_date?: ISODateString; // last date of a real service (not reminder)
  "Days Since Last Service"?: number | null;      // days since real-or-reminder contact
  "Days Since Last Real Service"?: number | null; // days since a real service

  "Mental Health"?: string;
  "Chronic Health"?: string;
  Developmental?: string;
  Physical?: string;
  "Substance Use Disorder"?: string;
  "General Health Status"?: string;
  "Cash Income Amount"?: number | null;
  Medicare?: string;
  "Hours Worked Last Week"?: string;
  "Employment Seeking"?: string;
  "Employment Tenure"?: string;

  "Risk Score"?: number;
  "Risk Level"?: "Low" | "Medium" | "High" | string;
}

export interface ServiceEvent {
  uid: string;
  Name: string;
  "Project Start Date": ISODateString;
  "Service Item Name": string;
  "Service Attendance Date": ISODateString;
  Count: number;
}

export interface DatasetMeta {
  uploadedAt: string; // ISO timestamp
  sourceFilename?: string;
  rawRows: number;
}

export interface Dataset {
  version: 1;
  meta: DatasetMeta;
  enrollments: Enrollment[];
  services: ServiceEvent[];
}
