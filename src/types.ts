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
  domain: string;  // Just the domain without wildcards (e.g., "linkedin.com")
  matchMode: 'domain-and-www' | 'all-subdomains' | 'exact';  // How to match the domain
  mode: 'light' | 'dark';
  groups?: string[];  // List of group names (optional, omit for "all enabled groups")
  groupMode?: 'only' | 'except';  // Defaults to 'only' if groups specified
}

export interface StorageData {
  groups: Group[];
  domains: Domain[];
  theme?: 'light' | 'auto' | 'dark';  // UI theme preference (default: 'auto')
}
