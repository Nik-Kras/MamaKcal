import { requireOptionalNativeModule } from "expo";

/** Android's share menu with pictures (android/…/ShareImageModule.kt). null where the native module isn't built in. */
export interface ShareImageModule {
  /** One JPEG (file:// URI or path) with its caption. Resolves once the share menu is open. */
  share(path: string, text: string, title: string): Promise<void>;
  /** Several JPEGs as one album, in this order; missing files are skipped. Resolves once the share menu is open. */
  shareMany(paths: string[], title: string): Promise<void>;
}

export const ShareImage = requireOptionalNativeModule<ShareImageModule>("ShareImage");
