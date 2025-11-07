export interface Group {
  id: string;
  name: string;
  enabled: boolean;  // Global on/off toggle for this group
  lightBgColor: string;
  lightTextColor: string;
  darkBgColor: string;
  darkTextColor: string;
  phrases: string[];
}

export interface Domain {
  id: string;
  pattern: string;
  mode: 'light' | 'dark';
  groups?: string[];  // List of group names (optional, omit for "all enabled groups")
  groupMode?: 'only' | 'except';  // Defaults to 'only' if groups specified
}

export interface StorageData {
  groups: Group[];
  domains: Domain[];
}
