package expo.modules.litertlm

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.StatFs
import java.io.File
import java.io.FileInputStream
import java.io.RandomAccessFile
import java.security.MessageDigest

/**
 * Fetches the photo model with Android's own DownloadManager: Wi-Fi only, a progress
 * notification, and it carries on (and resumes after a dropped connection) while the app
 * is closed. The file comes in parts (GitHub release files are limited to 2 GiB); once
 * they are all in, assemble() joins them into the model file and checks its SHA-256.
 *
 * Which downloads belong to us is kept in SharedPreferences, so a restarted app finds
 * them again.
 */
internal class ModelDownload(private val context: Context, private val dir: File, private val fileName: String) {
  class Part(val url: String, val bytes: Long)

  private val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
  private val prefs = context.getSharedPreferences("model-download", Context.MODE_PRIVATE)

  @Volatile var assembling = false
    private set

  private fun partName(i: Int) = "$fileName.part${i + 1}"
  private fun partFile(i: Int) = File(dir, partName(i))
  private fun ids(): List<Long> = prefs.getString("ids", "")!!.split(",").filter { it.isNotEmpty() }.map { it.toLong() }
  private fun sizes(): List<Long> = prefs.getString("sizes", "")!!.split(",").filter { it.isNotEmpty() }.map { it.toLong() }

  private class Row(val status: Int, val bytes: Long, val reason: Int)

  private fun query(id: Long): Row? {
    if (id <= 0) return null
    dm.query(DownloadManager.Query().setFilterById(id))?.use { c ->
      if (!c.moveToFirst()) return null
      return Row(
        c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)),
        c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)),
        c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)),
      )
    }
    return null
  }

  private fun enqueue(part: Part, i: Int, count: Int): Long {
    val request = DownloadManager.Request(Uri.parse(part.url))
      .setTitle("Калорії: розпізнавання фото")
      .setDescription("Частина ${i + 1} з $count")
      .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
      .setAllowedOverMetered(false)
      .setAllowedOverRoaming(false)
      .setDestinationInExternalFilesDir(context, "models", partName(i))
    return dm.enqueue(request)
  }

  /**
   * Start, or pick up, the download. Parts already on the phone are kept. Returns the bytes
   * still missing on the phone's storage, or 0 when it started.
   */
  fun start(parts: List<Part>, sha256: String): Long {
    dir.mkdirs()
    val old = ids()
    val remaining = parts.withIndex().sumOf { (i, p) -> if (partFile(i).length() == p.bytes) 0L else p.bytes - partFile(i).length().coerceAtMost(p.bytes) }
    // Joining appends the later parts to the first one, so they briefly take space twice.
    val need = remaining + parts.drop(1).sumOf { it.bytes } + 200L * 1024 * 1024
    val free = StatFs(dir.path).availableBytes
    if (free < need) return need - free

    val next = parts.mapIndexed { i, p ->
      val id = old.getOrNull(i) ?: 0L
      val row = query(id)
      val file = partFile(i)
      when {
        file.length() == p.bytes && (row == null || row.status == DownloadManager.STATUS_SUCCESSFUL) -> -1L
        row != null && row.status in setOf(DownloadManager.STATUS_PENDING, DownloadManager.STATUS_RUNNING, DownloadManager.STATUS_PAUSED) -> id
        else -> {
          if (id > 0) dm.remove(id)
          file.delete()
          enqueue(p, i, parts.size)
        }
      }
    }
    prefs.edit()
      .putString("ids", next.joinToString(","))
      .putString("sizes", parts.joinToString(",") { it.bytes.toString() })
      .putString("sha256", sha256)
      .remove("error")
      .apply()
    return 0
  }

  /**
   * state: idle | running | waiting (for Wi-Fi or a connection) | downloaded (all parts in,
   * not yet joined) | assembling | failed | done.
   */
  fun status(): Map<String, Any?> {
    val sizes = sizes()
    val total = sizes.sum()
    if (File(dir, fileName).isFile) {
      if (!assembling && ids().isNotEmpty()) tidyUp()
      return mapOf("state" to "done", "done" to total, "total" to total)
    }
    if (assembling) return mapOf("state" to "assembling", "done" to total, "total" to total)
    prefs.getString("error", null)?.let { return mapOf("state" to "failed", "done" to 0L, "total" to total, "reason" to it) }
    val ids = ids()
    if (ids.isEmpty() || sizes.isEmpty()) return mapOf("state" to "idle", "done" to 0L, "total" to total)

    var done = 0L
    var waiting = false
    var failed: String? = null
    var complete = true
    for ((i, size) in sizes.withIndex()) {
      val file = partFile(i)
      val row = query(ids.getOrElse(i) { 0L })
      if (row == null || row.status == DownloadManager.STATUS_SUCCESSFUL) {
        if (file.length() == size) {
          done += size
        } else {
          complete = false
          failed = failed ?: "missing"
        }
        continue
      }
      complete = false
      done += row.bytes.coerceIn(0L, size)
      when (row.status) {
        DownloadManager.STATUS_FAILED -> failed = failed ?: "http-${row.reason}"
        DownloadManager.STATUS_PAUSED ->
          if (row.reason == DownloadManager.PAUSED_QUEUED_FOR_WIFI || row.reason == DownloadManager.PAUSED_WAITING_FOR_NETWORK) waiting = true
      }
    }
    val state = when {
      failed != null -> "failed"
      complete -> "downloaded"
      waiting -> "waiting"
      else -> "running"
    }
    return mapOf("state" to state, "done" to done, "total" to total, "reason" to failed)
  }

  /**
   * Join the parts into the model file and check it. Safe to repeat after the app was
   * killed half-way: an interrupted join is cut back to the first part and done again.
   */
  fun assemble(): Boolean = synchronized(this) { join() }

  private fun join(): Boolean {
    val target = File(dir, fileName)
    if (target.isFile) return true
    val sizes = sizes()
    val expected = prefs.getString("sha256", null) ?: return false
    if (sizes.isEmpty() || sizes.indices.any { i -> i > 0 && partFile(i).length() != sizes[i] }) return false
    assembling = true
    try {
      val first = partFile(0)
      val digest = MessageDigest.getInstance("SHA-256")
      val buf = ByteArray(1 shl 20)
      RandomAccessFile(first, "rw").use { out ->
        if (out.length() > sizes[0]) out.setLength(sizes[0])
        if (out.length() != sizes[0]) return false
        while (true) {
          val n = out.read(buf)
          if (n < 0) break
          digest.update(buf, 0, n)
        }
        for (i in 1 until sizes.size) {
          FileInputStream(partFile(i)).use { input ->
            while (true) {
              val n = input.read(buf)
              if (n < 0) break
              digest.update(buf, 0, n)
              out.write(buf, 0, n)
            }
          }
        }
        out.fd.sync()
      }
      val actual = digest.digest().joinToString("") { "%02x".format(it) }
      val ids = ids().filter { it > 0 }.toLongArray()
      if (actual != expected) {
        if (ids.isNotEmpty()) dm.remove(*ids)
        sizes.indices.forEach { partFile(it).delete() }
        prefs.edit().remove("ids").putString("error", "corrupt").apply()
        return false
      }
      if (!first.renameTo(target)) return false
      // Forget our downloads (this also deletes the later parts).
      tidyUp()
      return true
    } finally {
      assembling = false
    }
  }

  /** The app was killed after the join but before tidying up: drop the leftover parts. */
  private fun tidyUp() {
    val ids = ids().filter { it > 0 }.toLongArray()
    if (ids.isNotEmpty()) dm.remove(*ids)
    sizes().indices.forEach { partFile(it).delete() }
    prefs.edit().clear().apply()
  }
}
