package expo.modules.shareimage

import android.content.ClipData
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Android's share menu with a picture and a caption together, so Telegram sends the
 * caption under the picture (expo-sharing sends a file only).
 *
 * The picture is copied into the app's cache folder, which expo-file-system's
 * FileProvider already serves to other apps (react-native-view-shot may write it to
 * the external cache, which that provider doesn't cover).
 */
class ShareImageModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ShareImage")

    AsyncFunction("share") { path: String, text: String, title: String ->
      val activity = appContext.currentActivity ?: throw CodedException("NO_ACTIVITY", "App is not in the foreground", null)
      val source = File(Uri.parse(path).path ?: path)
      val file = File(File(activity.cacheDir, "share").apply { mkdirs() }, "kalorii.jpg")
      source.copyTo(file, overwrite = true)
      val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.FileSystemFileProvider", file)
      val send = Intent(Intent.ACTION_SEND).apply {
        type = "image/jpeg"
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_TEXT, text)
        // Lets the share menu show the picture, and the chosen app read it.
        clipData = ClipData.newRawUri("", uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      activity.startActivity(Intent.createChooser(send, title))
    }.runOnQueue(Queues.MAIN)
  }
}
