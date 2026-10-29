import { requireOptionalNativeModule } from "expo";

/** The on-device photo model (android/…/LiteRtLmModule.kt). null where the native module isn't built in. */
export interface LiteRtLmModule {
  modelInfo(): { path: string; exists: boolean; bytes: number };
  warmUp(): Promise<boolean>;
  /** `requestId` identifies this photo for cancel(); use a new one per call. */
  describe(requestId: number, imagePath: string, prompt: string): Promise<string>;
  cancel(requestId: number): void;
  unload(): Promise<void>;
  /** Start, or pick up, downloading the model (Android DownloadManager, Wi-Fi only). Resolves to the free space still needed in bytes, 0 when started. */
  startModelDownload(parts: { url: string; bytes: number }[], sha256: string): Promise<number>;
  modelDownloadStatus(): Promise<ModelDownloadStatus>;
  /** Join the downloaded parts and check the SHA-256. false: not ready, or the file was damaged (status says "failed"). */
  finishModelDownload(): Promise<boolean>;
}

export type ModelDownloadState = "idle" | "running" | "waiting" | "downloaded" | "assembling" | "failed" | "done";

export interface ModelDownloadStatus {
  state: ModelDownloadState;
  done: number;
  total: number;
  /** For "failed": "corrupt", "missing" or "http-<DownloadManager reason>". */
  reason?: string | null;
}

export const LiteRtLm = requireOptionalNativeModule<LiteRtLmModule>("LiteRtLm");
