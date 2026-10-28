import { requireOptionalNativeModule } from "expo";

/** The on-device photo model (android/…/LiteRtLmModule.kt). null where the native module isn't built in. */
export interface LiteRtLmModule {
  modelInfo(): { path: string; exists: boolean; bytes: number };
  warmUp(): Promise<boolean>;
  /** `requestId` identifies this photo for cancel(); use a new one per call. */
  describe(requestId: number, imagePath: string, prompt: string): Promise<string>;
  cancel(requestId: number): void;
  unload(): Promise<void>;
}

export const LiteRtLm = requireOptionalNativeModule<LiteRtLmModule>("LiteRtLm");
