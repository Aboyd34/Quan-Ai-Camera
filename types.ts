
export interface CapturedImage {
  id: string;
  url: string;
  timestamp: number;
  mediaType: 'image' | 'video';
  analysis?: string;
  tips?: string[];
  grounding?: GroundingSource[];
  metadata?: {
    iso: string;
    shutter: string;
    lens: string;
    mode: string;
    filter?: string;
    role?: 'LEGATUS' | 'CENTURION';
    syncOffset?: number;
    enhanced?: boolean;
    zoom?: number;
    flash?: string;
  };
}

export interface GroundingSource {
  title: string;
  uri: string;
  type: 'web' | 'maps';
}

export interface GroundingLabel {
  text: string;
  x: number;
  y: number;
}

export enum CameraMode {
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO',
  SCOUT = 'SCOUT',
  CINEMA = 'CINEMA',
  HDR_FUSION = 'HDR_FUSION',
  NIGHT_STACK = 'NIGHT_STACK',
  AI_GENERATE = 'AI_GENERATE',
  LEGION_LINK = 'LEGION_LINK',
  M_PRO = 'M_PRO',
  PORTRAIT = 'PORTRAIT'
}

export type LegionRole = 'LEGATUS' | 'CENTURION';

export interface DeviceTelemetry {
  id: string;
  name: string;
  role: LegionRole;
  status: 'ONLINE' | 'RECORDING' | 'OFFLINE';
  battery?: number;
  storage?: string;
  currentLens: string;
  previewFrame?: string;
  lastPing: number;
}

export interface LegionMessage {
  type: 'HANDSHAKE' | 'SYNC' | 'START_REC' | 'STOP_REC' | 'HEARTBEAT' | 'TELEMETRY' | 'PREVIEW_FRAME' | 'COMMAND';
  timestamp: number;
  senderId: string;
  payload?: any;
}

export enum CameraFilter {
  NONE = 'NONE',
  VINTAGE_ROMA = 'VINTAGE_ROMA',
  IMPERIAL_MONO = 'IMPERIAL_MONO',
  NEURAL_VIBRANCE = 'NEURAL_VIBRANCE',
  CYBER_LATIUM = 'CYBER_LATIUM',
  GLOAMING = 'GLOAMING',
  MARBLE_STATUE = 'MARBLE_STATUE',
  AURELIUS = 'AURELIUS',
}

export enum LensProfile {
  STANDARD = 'STANDARD',
  ANAMORPHIC_1_33 = 'ANAMORPHIC_1.33x',
  ANAMORPHIC_1_55 = 'ANAMORPHIC_1.55x',
  MACRO = 'MACRO',
  WIDE = 'WIDE',
  TELEPHOTO = 'TELEPHOTO'
}

export interface ManualConfig {
  iso: number;
  shutter: string;
  ev: number;
  wb: number;
  zoom: number;
  flashMode: 'off' | 'on' | 'torch';
}

export interface CameraXTelemetry {
  frameRate: number;
  bufferState: 'READY' | 'BUFFERING' | 'STALLED';
  activeUseCase: 'PREVIEW' | 'CAPTURE' | 'ANALYSIS' | 'VEO';
  lensPosition: number;
  exposureValue: number;
}
