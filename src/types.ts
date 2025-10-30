export interface Group {
  id: string;
  name: string;
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
  groupIds: string[];
}

export interface StorageData {
  groups: Group[];
  domains: Domain[];
}
