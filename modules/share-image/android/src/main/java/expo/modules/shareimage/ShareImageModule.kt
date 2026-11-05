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
 * Android's share menu for «Поділитися».
 *
 * `share`: one picture and a caption together, so Telegram sends the caption under the
 * picture (expo-sharing sends a file only). `shareMany`: several pictures as one album.
 * Telegram ignores any text sent with several pictures, so the day's text goes as its
 * own message afterwards (D24).
 *
 * Pictures are copied into the app's cache folder, which expo-file-system's
 * FileProvider already serves to other apps (react-native-view-shot may write to the
 * external cache, which that provider doesn't cover).
 */
class ShareImageModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ShareImage")

    AsyncFunction("share") { path: String, text: String, title: String ->
      val activity = appContext.currentActivity ?: throw CodedException("NO_ACTIVITY", "App is not in the foreground", null)
      val file = File(shareDir(activity.cacheDir), "kalorii.jpg")
      source(path).copyTo(file, overwrite = true)
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

    AsyncFunction("shareMany") { paths: List<String>, title: String ->
      val activity = appContext.currentActivity ?: throw CodedException("NO_ACTIVITY", "App is not in the foreground", null)
      val dir = shareDir(activity.cacheDir)
      dir.listFiles { f -> f.name.startsWith("meal_") }?.forEach { it.delete() }
      val uris = ArrayList<Uri>()
      paths.map(::source).filter { it.isFile }.forEachIndexed { i, src ->
        val file = File(dir, "meal_${i + 1}.jpg")
        src.copyTo(file, overwrite = true)
        uris.add(FileProvider.getUriForFile(activity, "${activity.packageName}.FileSystemFileProvider", file))
      }
      if (uris.isEmpty()) throw CodedException("NO_PHOTOS", "None of the photos exist", null)
      val send = Intent(Intent.ACTION_SEND_MULTIPLE).apply {
        type = "image/jpeg"
        putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
        clipData = ClipData.newRawUri("", uris[0]).also { clip -> uris.drop(1).forEach { clip.addItem(ClipData.Item(it)) } }
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      activity.startActivity(Intent.createChooser(send, title))
    }.runOnQueue(Queues.MAIN)
  }

  private fun shareDir(cache: File) = File(cache, "share").apply { mkdirs() }

  private fun source(path: String) = File(Uri.parse(path).path ?: path)
}
