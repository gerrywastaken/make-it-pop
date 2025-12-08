// Core data types
export interface Group {
  id: string;
  name: string;
  enabled: boolean;
  lightBgColor: string;
  lightTextColor: string;
  darkBgColor: string;
  darkTextColor: string;
  phrases: string[];
}

export interface Domain {
  id: string;
  domain: string;  // Just the domain without wildcards (e.g., "linkedin.com")
  matchMode: 'domain-and-www' | 'all-subdomains' | 'exact';  // How to match the domain
  mode: 'light' | 'dark';
  groups?: string[];  // List of group names (optional, omit for "all enabled groups")
  groupMode?: 'only' | 'except';  // Defaults to 'only' if groups specified
}

// Export format types (user-friendly, no IDs)
export interface ExportGroup {
  name: string;
  enabled?: boolean;  // Optional for backwards compatibility, defaults to true
  lightBg: string;
  lightText: string;
  darkBg: string;
  darkText: string;
  phrases: string[];
}

export interface ExportDomain {
  domain: string;
  matchMode?: 'domain-and-www' | 'all-subdomains' | 'exact';  // Optional: defaults to 'domain-and-www'
  mode: 'light' | 'dark';
  groups?: string[];  // Optional: group names (omit for "all enabled groups")
  groupMode?: 'only' | 'except';  // Optional: defaults to 'only' if groups specified
}

export interface ExportData {
  groups: ExportGroup[];
  domains: ExportDomain[];
}

// Browser API - re-export from centralized module
export { browserAPI } from '../browserApi';
