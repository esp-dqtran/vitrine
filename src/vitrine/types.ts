export interface Screen {
  id: number;
  type: string;
  productArea: string;
  theme: 'light' | 'dark' | 'mixed';
  visibleStates: string[];
  platform: string;
  description: string | null;
  url: string;
}

export interface App {
  id: string;
  app: string;
  cat: string;
  accent: string;
  totalScreens: number;
  screens: Screen[];
}

export interface ElementItem {
  category: string;
  type: string;
  height: number;
}

export interface Flow {
  title: string;
  tags: string[];
  steps: string[];
  description: string;
}

export interface Progress {
  stage: 'crawl' | 'caption' | 'synthesize';
  app: string;
  done: number;
  total: number;
  status: 'running' | 'done' | 'error' | 'cancelled' | 'idle';
  message?: string;
  updatedAt: string;
}

export interface Job {
  id: number;
  parent_id: number | null;
  type: 'discover-catalog' | 'import-app' | 'caption-app' | 'synthesize-app';
  payload: { name?: string; url?: string };
  status: 'queued' | 'running' | 'done' | 'error' | 'cancelled';
  message: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface JobPipeline {
  root: Job;
  stages: Job[];
}

export type {
  DesignSystemSnapshot,
  EvidenceView,
  DesignToken,
  DesignComponent,
} from '../designSystem';
