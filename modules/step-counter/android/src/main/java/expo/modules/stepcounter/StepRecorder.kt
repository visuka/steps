package expo.modules.stepcounter

import android.content.Context
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.fitness.FitnessLocal
import com.google.android.gms.fitness.LocalRecordingClient
import com.google.android.gms.fitness.data.LocalDataType
import com.google.android.gms.fitness.data.LocalField
import com.google.android.gms.fitness.request.LocalDataReadRequest
import java.util.concurrent.TimeUnit

/**
 * Google Play services' Recording API on mobile: Play services counts the
 * phone's steps itself and keeps them, with their times, for 10 days. It runs
 * outside this app, so a battery saver that stops the app leaves no gap, and
 * it keeps recording through restarts. Data exists only from the moment of
 * the first subscription.
 */
object StepRecorder {
  /** "ready", "update-needed" (Play services too old) or "unavailable" (no Play services). */
  fun status(context: Context): String =
    when (
      GoogleApiAvailability.getInstance()
        .isGooglePlayServicesAvailable(context, LocalRecordingClient.LOCAL_RECORDING_CLIENT_STEPS_MIN_VERSION_CODE)
    ) {
      ConnectionResult.SUCCESS -> "ready"
      ConnectionResult.SERVICE_VERSION_UPDATE_REQUIRED, ConnectionResult.SERVICE_UPDATING -> "update-needed"
      else -> "unavailable"
    }

  /** Subscribes (a no-op when already subscribed) and remembers when recording first started. */
  fun start(context: Context, onDone: (sinceMs: Long?, error: Exception?) -> Unit) {
    if (status(context) != "ready") return onDone(null, null)
    val store = StepStore.get(context)
    // Without the activity permission Google doesn't record for the app, and
    // turning it off ends the subscription: what it has from then on starts
    // when recording starts again, so the counter covers the time before.
    if (!StepCounterService.canCount(context)) {
      if (store.getState(StepStore.RECORDER_SINCE, 0) != 0L) store.log("recorder", "stopped: permission is off")
      store.setState(StepStore.RECORDER_SINCE, 0)
      return onDone(null, null)
    }
    FitnessLocal.getLocalRecordingClient(context)
      .subscribe(LocalDataType.TYPE_STEP_COUNT_DELTA)
      .addOnSuccessListener {
        var since = store.getState(StepStore.RECORDER_SINCE, 0)
        if (since == 0L) {
          since = System.currentTimeMillis()
          store.setState(StepStore.RECORDER_SINCE, since)
          store.log("recorder", "started recording")
        }
        onDone(since, null)
      }
      .addOnFailureListener { e -> onDone(null, e) }
  }

  fun stop(context: Context) {
    StepStore.get(context).setState(StepStore.RECORDER_SINCE, 0)
    if (status(context) == "ready") {
      FitnessLocal.getLocalRecordingClient(context).unsubscribe(LocalDataType.TYPE_STEP_COUNT_DELTA)
    }
  }

  /** Steps per minute between the two times, as (minute start ms, steps); minutes without steps are left out. */
  fun minutes(
    context: Context,
    startMs: Long,
    endMs: Long,
    onResult: (List<Pair<Long, Long>>) -> Unit,
    onError: (Exception) -> Unit,
  ) {
    if (endMs <= startMs) return onResult(emptyList())
    val request = LocalDataReadRequest.Builder()
      .aggregate(LocalDataType.TYPE_STEP_COUNT_DELTA)
      .bucketByTime(1, TimeUnit.MINUTES)
      // Both ends are inclusive.
      .setTimeRange(startMs, endMs - 1, TimeUnit.MILLISECONDS)
      .build()
    FitnessLocal.getLocalRecordingClient(context)
      .readData(request)
      .addOnSuccessListener { response ->
        val result = mutableListOf<Pair<Long, Long>>()
        for (bucket in response.buckets) {
          var steps = 0L
          for (set in bucket.dataSets) {
            for (point in set.dataPoints) steps += point.getValue(LocalField.FIELD_STEPS).asInt()
          }
          if (steps > 0) result.add(bucket.getStartTime(TimeUnit.MILLISECONDS) to steps)
        }
        onResult(result)
      }
      .addOnFailureListener(onError)
  }

  /** Total steps between the two times (for the notification). */
  fun total(context: Context, startMs: Long, endMs: Long, onResult: (Long) -> Unit, onError: (Exception) -> Unit) {
    if (endMs <= startMs) return onResult(0)
    val request = LocalDataReadRequest.Builder()
      .aggregate(LocalDataType.TYPE_STEP_COUNT_DELTA)
      .bucketByTime(1, TimeUnit.DAYS)
      .setTimeRange(startMs, endMs - 1, TimeUnit.MILLISECONDS)
      .build()
    FitnessLocal.getLocalRecordingClient(context)
      .readData(request)
      .addOnSuccessListener { response ->
        var steps = 0L
        for (bucket in response.buckets) {
          for (set in bucket.dataSets) {
            for (point in set.dataPoints) steps += point.getValue(LocalField.FIELD_STEPS).asInt()
          }
        }
        onResult(steps)
      }
      .addOnFailureListener(onError)
  }
}
