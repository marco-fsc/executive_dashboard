export type ISODateString = string;

export interface Enrollment {
  uid: string;
  Name: string; // Program name
  "Project Start Date": ISODateString;
  "Project Exit Date"?: ISODateString;
  "Active in Project": "Yes" | "No" | string;
  "Assigned Staff"?: string;
  "Destination Category"?: string;
  Destination?: string;
  "Days in Project"?: number;

  last_service_date?: ISODateString;
  service_count?: number;
  "Days Since Last Service"?: number | null;

  "Mental Health"?: string;
  "Chronic Health"?: string;
  Developmental?: string;
  Physical?: string;
  "Substance Use Disorder"?: string;
  "General Health Status"?: string;
  "Cash Income Amount"?: number | null;

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
