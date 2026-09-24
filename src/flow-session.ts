export type FlowStep =
  | "idle"
  | "name"
  | "gender"
  | "age"
  | "city"
  | "bio"
  | "photos"
  | "edit-name"
  | "edit-city"
  | "edit-bio"
  | "edit-photos";

export interface Draft {
  name?: string;
  gender?: string;
  age?: number;
  birthdate?: string;
  city?: string;
  bio?: string;
  photos: string[];
}

export interface FlowSession {
  step?: FlowStep;
  draft?: Draft;
  domain?: { profile?: ProfileRecord; settings?: SettingsRecord };
}

export interface ProfileRecord {
  profileId: string;
  userId: number;
  name: string;
  gender?: string;
  age: number;
  birthdate?: string;
  city?: string;
  bio?: string;
  photos: string[];
  updatedAt: string;
}

export interface SettingsRecord {
  userId: number;
  notifyOnMatch: boolean;
  notifyOnMessage: boolean;
  searchPrefsBasic: string;
}
