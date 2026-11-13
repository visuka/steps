package expo.modules.stepcounter

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.DetectedActivity

/**
 * Activity Recognition results while a walk or ride records. Stores every
 * activity with confidence 30+ at the result's time, in one transaction, and
 * hands the result to the running service for the pin check. It never
 * starts the service, and stops the updates whenever no recording is
 * running (they would otherwise wake the app every 10 s for good).
 */
class WalkActivityReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    // A crash here would kill the process, and the recording with it.
    try {
      val store = StepStore.get(context)
      val walkId = store.getState(StepStore.WALK_ID, 0)
      if (!WalkService.isRunning || walkId == 0L) {
        WalkService.stopActivityUpdates(context)
        return
      }
      if (!ActivityRecognitionResult.hasResult(intent)) return
      val result = ActivityRecognitionResult.extractResult(intent) ?: return
      val rows = result.probableActivities
        .filter { it.confidence >= 30 }
        .map { typeName(it.type) to it.confidence }
      if (rows.isEmpty()) return
      store.addWalkActivities(walkId, result.time, rows)
      val vehicle = rows.filter { it.first == "vehicle" }.maxOfOrNull { it.second } ?: 0
      val bicycle = rows.filter { it.first == "bicycle" }.maxOfOrNull { it.second } ?: 0
      WalkService.onActivity(vehicle, bicycle)
    } catch (e: Exception) {
      runCatching { StepStore.get(context).log("walk", "activity result failed: ${e.javaClass.simpleName}") }
    }
  }

  companion object {
    fun typeName(type: Int): String =
      when (type) {
        DetectedActivity.IN_VEHICLE -> "vehicle"
        DetectedActivity.ON_BICYCLE -> "bicycle"
        DetectedActivity.ON_FOOT -> "foot"
        DetectedActivity.WALKING -> "walking"
        DetectedActivity.RUNNING -> "running"
        DetectedActivity.STILL -> "still"
        DetectedActivity.TILTING -> "tilting"
        else -> "unknown"
      }
  }
}
