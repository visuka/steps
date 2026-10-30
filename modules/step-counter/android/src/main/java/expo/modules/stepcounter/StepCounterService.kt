package expo.modules.stepcounter

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import java.text.NumberFormat
import java.util.Calendar
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

/**
 * Keeps TYPE_STEP_COUNTER registered so the hardware keeps counting, and turns
 * its running total into per-minute buckets. The ongoing notification it must
 * show doubles as a glanceable step count.
 */
class StepCounterService : Service(), SensorEventListener {
  private lateinit var store: StepStore
  private lateinit var sensorManager: SensorManager
  private var lastNotifiedAt = 0L

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    store = StepStore.get(this)
    sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
    createChannel()
    ServiceCompat.startForeground(
      this,
      NOTIFICATION_ID,
      buildNotification(todaySteps()),
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH else 0
    )
    sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)?.let {
      // Let the hardware batch up to a minute of events; the counter keeps counting meanwhile.
      sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL, 60_000_000)
    }
    isRunning = true
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

  override fun onDestroy() {
    sensorManager.unregisterListener(this)
    isRunning = false
    super.onDestroy()
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  override fun onSensorChanged(event: SensorEvent) {
    val reading = event.values[0].toLong()
    val eventAt = System.currentTimeMillis() - (SystemClock.elapsedRealtimeNanos() - event.timestamp) / 1_000_000
    val last = store.getState(StepStore.LAST_READING, -1)
    val lastEventAt = store.getState(StepStore.LAST_EVENT_AT, eventAt)

    val delta = when {
      last < 0 -> 0L // First reading after install: just a baseline.
      reading < last -> reading // The phone rebooted and the counter restarted from zero.
      else -> reading - last
    }
    store.setState(StepStore.LAST_READING, reading)
    store.setState(StepStore.LAST_EVENT_AT, eventAt)
    if (delta > 0) record(delta, lastEventAt, eventAt)

    if (eventAt - lastNotifiedAt > 30_000) {
      lastNotifiedAt = eventAt
      getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification(todaySteps()))
    }
  }

  /**
   * A long gap between events (process restart, batching) arrives as one big
   * delta; spread it back over the gap at no more than 120 steps a minute so it
   * doesn't look like a sprint.
   */
  private fun record(delta: Long, fromMs: Long, toMs: Long) {
    val endMinute = toMs / 60_000
    val gapMinutes = max(1L, endMinute - fromMs / 60_000)
    val minutes = min(gapMinutes, max(1L, ceil(delta / 120.0).toLong()))
    val perMinute = delta / minutes
    var remainder = delta - perMinute * minutes
    for (i in 0 until minutes) {
      val extra = if (remainder > 0) 1 else 0
      remainder -= extra
      store.addSteps(endMinute - i, perMinute + extra)
    }
  }

  private fun todaySteps(): Long {
    val start = Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }.timeInMillis
    return store.sum(start, System.currentTimeMillis() + 60_000)
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(CHANNEL_ID, "Step counting", NotificationManager.IMPORTANCE_LOW).apply {
      description = "Shows today's steps while the app counts them"
      setShowBadge(false)
    }
    getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  private fun buildNotification(steps: Long): Notification {
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val tap = PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val icon = resources.getIdentifier("notification_icon", "drawable", packageName)
      .takeIf { it != 0 } ?: applicationInfo.icon
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(icon)
      .setContentTitle("${NumberFormat.getIntegerInstance().format(steps)} steps today")
      .setContentText("Counting steps in the background")
      .setContentIntent(tap)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }

  companion object {
    private const val CHANNEL_ID = "step-counter"
    private const val NOTIFICATION_ID = 7001

    @Volatile var isRunning = false
      private set

    fun start(context: Context) {
      StepStore.get(context).setState(StepStore.ENABLED, 1)
      val intent = Intent(context, StepCounterService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
    }

    fun stop(context: Context) {
      StepStore.get(context).setState(StepStore.ENABLED, 0)
      context.stopService(Intent(context, StepCounterService::class.java))
    }
  }
}
