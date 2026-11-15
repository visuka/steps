package expo.modules.stepcounter

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity

/**
 * Android's own guess at what the person is doing, all day (T18a: only
 * recorded). The Activity Recognition Transition API tells when walking,
 * running, cycling, driving or being still starts and stops; the service asks
 * for it when it starts and ActivityTransitionReceiver stores what comes.
 * Separate from WalkActivityReceiver, which serves a recording.
 */
object ActivityTransitions {
  private const val REQUEST_CODE = 7004

  private val ACTIVITIES = intArrayOf(
    DetectedActivity.WALKING,
    DetectedActivity.RUNNING,
    DetectedActivity.ON_BICYCLE,
    DetectedActivity.IN_VEHICLE,
    DetectedActivity.STILL,
  )

  fun request(): ActivityTransitionRequest {
    val transitions = ArrayList<ActivityTransition>()
    for (type in ACTIVITIES) {
      for (kind in intArrayOf(ActivityTransition.ACTIVITY_TRANSITION_ENTER, ActivityTransition.ACTIVITY_TRANSITION_EXIT)) {
        transitions.add(
          ActivityTransition.Builder()
            .setActivityType(type)
            .setActivityTransition(kind)
            .build()
        )
      }
    }
    return ActivityTransitionRequest(transitions)
  }

  fun pendingIntent(context: Context): PendingIntent {
    val intent = Intent(context, ActivityTransitionReceiver::class.java)
    // Play services fills the result into the intent, so it must be mutable on Android 12+.
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or
      (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
    return PendingIntent.getBroadcast(context, REQUEST_CODE, intent, flags)
  }

  /** Asks again on every start of the counter (a restart of the phone forgets it). A failure is only logged. */
  @SuppressLint("MissingPermission")
  fun register(context: Context, store: StepStore) {
    if (!StepCounterService.canCount(context)) return
    try {
      ActivityRecognition.getClient(context)
        .requestActivityTransitionUpdates(request(), pendingIntent(context))
        .addOnFailureListener { e -> runCatching { store.log("activity", "transitions refused: ${e.javaClass.simpleName}") } }
    } catch (e: Exception) {
      runCatching { store.log("activity", "transitions failed: ${e.javaClass.simpleName}") }
    }
  }

  @SuppressLint("MissingPermission")
  fun unregister(context: Context) {
    try {
      ActivityRecognition.getClient(context).removeActivityTransitionUpdates(pendingIntent(context))
    } catch (e: Exception) {
      // Nothing to undo if Play services isn't there.
    }
  }
}

/** Stores each transition (time, activity, enter or exit); never starts the service. */
class ActivityTransitionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    // A crash here would kill the process, and the day's counting with it.
    try {
      if (!ActivityTransitionResult.hasResult(intent)) return
      val result = ActivityTransitionResult.extractResult(intent) ?: return
      val nowMs = System.currentTimeMillis()
      val nowNs = SystemClock.elapsedRealtimeNanos()
      val rows = result.transitionEvents.map { e ->
        StepStore.Transition(
          t = MovementSchedule.wallClock(nowMs, nowNs, e.elapsedRealTimeNanos),
          activity = WalkActivityReceiver.typeName(e.activityType),
          enter = e.transitionType == ActivityTransition.ACTIVITY_TRANSITION_ENTER,
        )
      }
      if (rows.isNotEmpty()) StepStore.get(context).addActivityTransitions(rows)
    } catch (e: Exception) {
      runCatching { StepStore.get(context).log("activity", "transition result failed: ${e.javaClass.simpleName}") }
    }
  }
}
