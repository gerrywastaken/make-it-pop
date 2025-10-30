export interface Group {
  id: string;
  name: string;
  color: string;
  phrases: string[];
}

export interface Domain {
  id: string;
  pattern: string;
  groupIds: string[];
}

export interface StorageData {
  groups: Group[];
  domains: Domain[];
}
