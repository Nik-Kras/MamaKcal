import { requireOptionalNativeModule } from "expo";

/** Android's share menu with a picture and its caption (android/…/ShareImageModule.kt). null where the native module isn't built in. */
export interface ShareImageModule {
  /** `path`: a JPEG file (file:// URI or path). Resolves once the share menu is open. */
  share(path: string, text: string, title: string): Promise<void>;
}

export const ShareImage = requireOptionalNativeModule<ShareImageModule>("ShareImage");
