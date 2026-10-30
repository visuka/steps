package expo.modules.stepcounter

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

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

    AsyncFunction("start") { StepCounterService.start(context) }

    AsyncFunction("stop") { StepCounterService.stop(context) }

    AsyncFunction("getBuckets") { startMs: Double, endMs: Double ->
      StepStore.get(context).buckets(startMs.toLong(), endMs.toLong()).map { (start, steps) ->
        mapOf("start" to start.toDouble(), "steps" to steps.toDouble())
      }
    }

    AsyncFunction("clear") { StepStore.get(context).clear() }
  }
}
