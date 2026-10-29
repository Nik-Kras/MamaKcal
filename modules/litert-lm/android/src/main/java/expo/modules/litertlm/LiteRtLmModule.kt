package expo.modules.litertlm

import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.SamplerConfig
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.util.Collections
import java.util.concurrent.Executors
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.cancel

/**
 * The on-device photo model: Gemma 3n E2B through LiteRT-LM, as benchmarked in
 * bench/. The model file is downloaded once (ModelDownload, or adb push, see README)
 * into the app's own storage. One engine stays loaded while the app runs.
 *
 * Loading and describing run on this module's own thread, one at a time: they
 * take seconds, and Expo's shared async queue (image picker, image manipulator,
 * file system) must not wait behind them.
 */
class LiteRtLmModule : Module() {
  private val executor = Executors.newSingleThreadExecutor { r -> Thread(r, "litert-lm") }
  private val modelScope = CoroutineScope(executor.asCoroutineDispatcher())
  /** Downloading and joining the model file: disk and network, never the model thread. */
  private val ioScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
  private var download: ModelDownload? = null

  // Lock order: runLock, then engineLock.
  private val runLock = Any()
  private val engineLock = Any()
  private var engine: Engine? = null

  /** The photo being described right now, so Скасувати can stop exactly that one. */
  @Volatile private var current: Pair<Int, Conversation>? = null
  private val cancelled = Collections.synchronizedSet(HashSet<Int>())

  private fun modelDir(): File {
    val context = appContext.reactContext ?: throw CodedException("NO_CONTEXT", "App is not ready", null)
    return context.getExternalFilesDir("models") ?: throw CodedException("NO_STORAGE", "No app storage", null)
  }

  private fun modelFile(): File = File(modelDir(), MODEL_FILE)

  private fun downloads(): ModelDownload = synchronized(this) {
    download ?: ModelDownload(appContext.reactContext!!.applicationContext, modelDir(), MODEL_FILE).also { download = it }
  }

  /** Load the model once (several seconds). The image encoder only runs on the GPU. */
  private fun engine(): Engine = synchronized(engineLock) {
    engine?.let { return it }
    val file = modelFile()
    if (!file.isFile) throw CodedException("NO_MODEL", "Model file missing: ${file.absolutePath}", null)
    val created = Engine(
      EngineConfig(
        modelPath = file.absolutePath,
        backend = Backend.GPU(),
        visionBackend = Backend.GPU(),
        maxNumTokens = 1024,
        maxNumImages = 1,
        cacheDir = appContext.reactContext?.cacheDir?.absolutePath,
      ),
    )
    try {
      created.initialize()
    } catch (e: Throwable) {
      // close() itself throws on an engine that never initialised; keep the real cause.
      if (created.isInitialized()) runCatching { created.close() }
      throw CodedException("LOAD_FAILED", "Model failed to load: ${e.message}", e)
    }
    engine = created
    created
  }

  private fun stopCurrent() {
    current?.let { (_, conversation) -> runCatching { conversation.cancelProcess() } }
  }

  override fun definition() = ModuleDefinition {
    Name("LiteRtLm")

    Function("modelInfo") {
      val file = modelFile()
      mapOf("path" to file.absolutePath, "exists" to file.isFile, "bytes" to (if (file.isFile) file.length() else 0L))
    }

    /** Load the model ahead of the first photo, e.g. when the camera opens. */
    AsyncFunction("warmUp") {
      if (!modelFile().isFile) return@AsyncFunction false
      engine()
      true
    }.runOnQueue(modelScope)

    /** Describe one photo; returns the model's raw text answer. `requestId` lets cancel() target it. */
    AsyncFunction("describe") { requestId: Int, imagePath: String, prompt: String ->
      synchronized(runLock) {
        if (cancelled.remove(requestId)) throw CodedException("CANCELLED", "Cancelled", null)
        val conversation = engine().createConversation(
          ConversationConfig(
            samplerConfig = SamplerConfig(topK = 1, topP = 1.0, temperature = 0.0),
            maxOutputToken = 200,
          ),
        )
        current = requestId to conversation
        try {
          // Cancelled while the model was loading or the conversation was being set up.
          if (cancelled.remove(requestId)) throw CodedException("CANCELLED", "Cancelled", null)
          val reply = conversation.sendMessage(Contents.of(Content.ImageFile(imagePath), Content.Text(prompt)))
          reply.contents.contents.filterIsInstance<Content.Text>().joinToString("") { it.text }
        } catch (e: CodedException) {
          throw e
        } catch (e: Throwable) {
          throw CodedException("DESCRIBE_FAILED", "Model failed: ${e.message}", e)
        } finally {
          current = null
          cancelled.remove(requestId)
          runCatching { conversation.close() }
        }
      }
    }.runOnQueue(modelScope)

    /** Stop one photo (she pressed Скасувати, or it timed out), whether it is running or still waiting. */
    Function("cancel") { requestId: Int ->
      cancelled.add(requestId)
      val running = current
      if (running != null && running.first == requestId) runCatching { running.second.cancelProcess() }
    }

    /** Start (or pick up) downloading the model. Returns the bytes of free space still needed, 0 when started. */
    AsyncFunction("startModelDownload") { parts: List<ModelPart>, sha256: String ->
      downloads().start(parts.map { ModelDownload.Part(it.url, it.bytes.toLong()) }, sha256)
    }.runOnQueue(ioScope)

    AsyncFunction("modelDownloadStatus") {
      downloads().status()
    }.runOnQueue(ioScope)

    /** Join the downloaded parts into the model file and check its SHA-256 (takes a little while). */
    AsyncFunction("finishModelDownload") {
      downloads().assemble()
    }.runOnQueue(ioScope)

    AsyncFunction("unload") {
      synchronized(runLock) {
        synchronized(engineLock) {
          engine?.close()
          engine = null
        }
      }
    }.runOnQueue(modelScope)

    OnDestroy {
      // Stop a running photo first, then wait for it to let go before the engine is freed.
      stopCurrent()
      synchronized(runLock) {
        synchronized(engineLock) {
          runCatching { engine?.close() }
          engine = null
        }
      }
      modelScope.cancel()
      ioScope.cancel()
      executor.shutdown()
    }
  }

  class ModelPart : Record {
    @Field val url: String = ""
    @Field val bytes: Double = 0.0
  }

  companion object {
    const val MODEL_FILE = "gemma-3n-E2B-it-int4.litertlm"
  }
}
