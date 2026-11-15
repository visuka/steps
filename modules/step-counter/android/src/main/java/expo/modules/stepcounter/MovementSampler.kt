package expo.modules.stepcounter

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper
import android.os.SystemClock

/**
 * Reads the accelerometer for one short burst (MovementSchedule.BURST_MS) and
 * stores the minute's figures (MovementFeatures). The wake-up variant with a
 * batching delay of the burst's length hands over the whole burst at once, so
 * the phone's processor can sleep while it is read, and no wake lock is
 * needed. The listener is unregistered after every burst: nothing runs between
 * bursts. Always used on the main thread.
 */
class MovementSampler(context: Context, private val store: StepStore) : SensorEventListener {
  private val sensors = context.applicationContext.getSystemService(Context.SENSOR_SERVICE) as SensorManager
  private val handler = Handler(Looper.getMainLooper())
  private var active = false
  private var startedAt = 0L
  private var startedElapsed = 0L
  private var lastKeptNs = 0L
  private var baseNs = 0L
  private var count = 0
  private var t = DoubleArray(CAPACITY)
  private var x = DoubleArray(CAPACITY)
  private var y = DoubleArray(CAPACITY)
  private var z = DoubleArray(CAPACITY)

  /** Gives up on a burst that never completes (no readings came), keeping what it has if that is enough. */
  private val giveUp = Runnable { finish() }

  /**
   * Starts a burst; false when one is running or the phone has no wake-up
   * accelerometer. The ordinary accelerometer is not used: with the screen off
   * it never wakes the processor, so it would stay powered between bursts.
   */
  fun start(nowMs: Long): Boolean {
    if (active) {
      // A burst that outlived its time (the timer does not run in deep sleep) is closed first.
      if (MovementSchedule.isStale(SystemClock.elapsedRealtime(), startedElapsed)) finish() else return false
    }
    val sensor = sensors.getDefaultSensor(Sensor.TYPE_ACCELEROMETER, true) ?: return false
    count = 0
    baseNs = 0L
    lastKeptNs = 0L
    startedAt = nowMs
    startedElapsed = SystemClock.elapsedRealtime()
    val registered = sensors.registerListener(
      this,
      sensor,
      SAMPLE_PERIOD_US,
      (MovementSchedule.BURST_MS * 1000).toInt()
    )
    if (!registered) return false
    active = true
    handler.postDelayed(giveUp, MovementSchedule.BURST_MS + GIVE_UP_EXTRA_MS)
    return true
  }

  /** Ends a burst without storing it (the service is going away). */
  fun stop() {
    handler.removeCallbacks(giveUp)
    if (active) sensors.unregisterListener(this)
    active = false
    count = 0
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  override fun onSensorChanged(event: SensorEvent) {
    if (!active || event.values.size < 3) return
    if (MovementSchedule.isStale(SystemClock.elapsedRealtime(), startedElapsed)) {
      finish()
      return
    }
    if (count == 0) baseNs = event.timestamp
    // A phone that ignores the 40 ms hint and sends faster is thinned to about 33 Hz at most,
    // so the burst still covers its full length and the maths stays small.
    if (count < CAPACITY && (count == 0 || event.timestamp - lastKeptNs >= MIN_KEEP_NS)) {
      t[count] = (event.timestamp - baseNs) / 1_000_000_000.0
      x[count] = event.values[0].toDouble()
      y[count] = event.values[1].toDouble()
      z[count] = event.values[2].toDouble()
      lastKeptNs = event.timestamp
      count++
    }
    val span = if (count > 1) t[count - 1] else 0.0
    if (span >= DONE_AFTER_S || count >= CAPACITY) finish()
  }

  private fun finish() {
    if (!active) return
    handler.removeCallbacks(giveUp)
    sensors.unregisterListener(this)
    active = false
    try {
      val n = count
      if (n < MovementFeatures.MIN_SAMPLES || t[n - 1] < MovementFeatures.MIN_BURST_S) return
      val burst = MovementFeatures.Burst(t.copyOf(n), x.copyOf(n), y.copyOf(n), z.copyOf(n))
      val figures = MovementFeatures.compute(burst)
      // Too short or too few readings: store nothing (a row of zeros would look like a real reading).
      if (figures === MovementFeatures.NONE) return
      store.addMinuteFeatures(
        minute = MovementSchedule.minuteOf(startedAt),
        burstMs = (t[n - 1] * 1000).toLong(),
        samples = n,
        figures = figures
      )
    } catch (e: Exception) {
      runCatching { store.log("movement", "burst failed: ${e.javaClass.simpleName}") }
    }
  }

  companion object {
    /** About 25 Hz. */
    private const val SAMPLE_PERIOD_US = 40_000
    /** The batch arrives a little before the full burst; this is enough to use it. */
    private const val DONE_AFTER_S = 9.0
    private const val GIVE_UP_EXTRA_MS = 5_000L
    /** Readings closer than this (about 33 Hz) are skipped. */
    private const val MIN_KEEP_NS = 30_000_000L
    /** 10 s at the 33 Hz cap is 333 readings; this also bounds the buzz maths (a direct DFT). */
    private const val CAPACITY = 400
  }
}
