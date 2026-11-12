package expo.modules.stepcounter

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorManager
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RecorderException(cause: Throwable?) :
  CodedException("ERR_STEP_RECORDER", "Google's step recorder failed: ${cause?.message ?: "unknown error"}", cause)

class StepCounterModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  override fun definition() = ModuleDefinition {
    Name("StepCounter")

    Function("isSupported") {
      val sensors = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
      sensors.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
    }

    Function("isRunning") { StepCounterService.isRunning }

    // Waits for the counter's first reading, so a sync right after sees the steps it brings.
    AsyncFunction("start") { StepCounterService.startAndWait(context, 2_000) }

    AsyncFunction("stop") { StepCounterService.stop(context) }

    AsyncFunction("getBuckets") { startMs: Double, endMs: Double ->
      StepStore.get(context).buckets(startMs.toLong(), endMs.toLong()).map { (start, steps) ->
        mapOf("start" to start.toDouble(), "steps" to steps.toDouble())
      }
    }

    AsyncFunction("getUntimed") { startMs: Double, endMs: Double ->
      StepStore.get(context).untimed(startMs.toLong(), endMs.toLong())
    }

    AsyncFunction("getLog") { limit: Int -> StepStore.get(context).logEntries(limit) }

    AsyncFunction("clear") { StepStore.get(context).clear() }

    Function("recorderStatus") { StepRecorder.status(context) }

    Function("recorderSince") {
      StepStore.get(context).getState(StepStore.RECORDER_SINCE, 0).takeIf { it != 0L }?.toDouble()
    }

    AsyncFunction("startRecorder") { promise: Promise ->
      StepRecorder.start(context) { since, error ->
        if (error != null) promise.reject(RecorderException(error)) else promise.resolve(since?.toDouble())
      }
    }

    AsyncFunction("stopRecorder") { StepRecorder.stop(context) }

    AsyncFunction("getRecorderBuckets") { startMs: Double, endMs: Double, promise: Promise ->
      StepRecorder.minutes(
        context,
        startMs.toLong(),
        endMs.toLong(),
        { minutes -> promise.resolve(minutes.map { (start, steps) -> mapOf("start" to start.toDouble(), "steps" to steps.toDouble()) }) },
        { error -> promise.reject(RecorderException(error)) }
      )
    }

    AsyncFunction("startWalk") { WalkService.start(context).toDouble() }

    AsyncFunction("stopWalk") { WalkService.stop(context) }

    Function("activeWalk") {
      StepStore.get(context).getState(StepStore.WALK_ID, 0).takeIf { it != 0L }?.toDouble()
    }

    Function("isWalkRecording") { WalkService.isRunning }

    AsyncFunction("getWalkPoints") { walkId: Double, afterT: Double ->
      StepStore.get(context).walkPoints(walkId.toLong(), afterT.toLong())
    }

    AsyncFunction("clearWalk") { walkId: Double ->
      val store = StepStore.get(context)
      store.clearWalk(walkId.toLong())
      if (store.getState(StepStore.WALK_ID, 0) == walkId.toLong()) store.setState(StepStore.WALK_ID, 0)
    }
  }
}
