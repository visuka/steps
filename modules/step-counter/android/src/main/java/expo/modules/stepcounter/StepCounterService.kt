package expo.modules.stepcounter

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener2
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import java.text.DateFormat
import java.text.NumberFormat
import java.util.Calendar
import java.util.Date
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Keeps TYPE_STEP_COUNTER registered so the hardware keeps counting, and turns
 * its running total into per-minute buckets (StepAttribution decides when the
 * steps were taken). The ongoing notification it must show doubles as a
 * glanceable step count. When Google's step recorder is in use, the app reads
 * steps from there and this counter is the backup and the notification.
 */
class StepCounterService : Service(), SensorEventListener2 {
  private lateinit var store: StepStore
  private lateinit var sensorManager: SensorManager
  private val handler = Handler(Looper.getMainLooper())
  private var listeningSince = 0L
  private var previousAliveAt = 0L
  private var lastNotifiedElapsed = 0L
  private var shownSteps = -1L
  /** A recorder read can finish after the service stopped; it mustn't post a notification then. */
  @Volatile private var destroyed = false

  private val refreshNotification = Runnable { updateNotification() }
  /** Best effort (it doesn't run while the phone sleeps): narrows the stretch a later restart can't account for. */
  private val heartbeat = object : Runnable {
    override fun run() {
      store.setState(StepStore.LAST_ALIVE_AT, System.currentTimeMillis())
      handler.postDelayed(this, HEARTBEAT_MS)
    }
  }
  private val atMidnight = object : Runnable {
    override fun run() {
      updateNotification()
      scheduleMidnight()
    }
  }
  private val clockChanged = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      // The midnight timer doesn't run while the phone sleeps, so it can be
      // late; the screen coming on is when the notification can be seen anyway.
      if (intent.action != Intent.ACTION_SCREEN_ON) store.log("clock", intent.action?.substringAfterLast('.') ?: "changed")
      updateNotification()
      scheduleMidnight()
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    store = StepStore.get(this)
    sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
    createChannel()
    try {
      ServiceCompat.startForeground(
        this,
        NOTIFICATION_ID,
        buildNotification(null),
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH else 0
      )
    } catch (e: Exception) {
      // Android 14+ refuses a health service once the activity permission is
      // turned off; a sticky restart after that must stop, not crash the app.
      store.log("counter", "could not start: ${e.javaClass.simpleName}")
      // Turning the permission off also ends Google's recording for the app.
      store.setState(StepStore.RECORDER_SINCE, 0)
      firstReading?.countDown()
      stopSelf()
      return
    }
    // The wake-up variant wakes the phone before its buffer fills, so batched
    // steps keep their own times instead of being dropped and merged.
    val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER, true)
      ?: sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    if (sensor != null) {
      // Let the hardware batch up to a minute of events; the counter keeps counting meanwhile.
      sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL, BATCH_LATENCY_US)
    }
    listeningSince = System.currentTimeMillis()
    previousAliveAt = store.getState(StepStore.LAST_ALIVE_AT, 0)
    store.log("counter", "listening")
    handler.postDelayed(heartbeat, HEARTBEAT_MS)
    if (sensor != null) sensorManager.flush(this) else firstReading?.countDown()
    ContextCompat.registerReceiver(
      this,
      clockChanged,
      IntentFilter().apply {
        addAction(Intent.ACTION_TIME_CHANGED)
        addAction(Intent.ACTION_TIMEZONE_CHANGED)
        addAction(Intent.ACTION_DATE_CHANGED)
        addAction(Intent.ACTION_SCREEN_ON)
      },
      ContextCompat.RECEIVER_NOT_EXPORTED
    )
    scheduleMidnight()
    updateNotification()
    isRunning = true
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

  override fun onDestroy() {
    destroyed = true
    if (isRunning) store.setState(StepStore.LAST_ALIVE_AT, System.currentTimeMillis())
    sensorManager.unregisterListener(this)
    handler.removeCallbacksAndMessages(null)
    runCatching { unregisterReceiver(clockChanged) }
    // Turned off in the app (not stopped by Android): steps taken while it's
    // off aren't the counter's, so the next start is a fresh baseline.
    if (store.getState(StepStore.ENABLED, 0) == 0L) store.clearCounterState()
    if (isRunning) store.log("counter", "stopped")
    isRunning = false
    super.onDestroy()
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  override fun onFlushCompleted(sensor: Sensor?) {
    firstReading?.countDown()
  }

  override fun onSensorChanged(event: SensorEvent) {
    val now = System.currentTimeMillis()
    val elapsedNs = SystemClock.elapsedRealtimeNanos()
    // Step events are stamped on the boot clock; a stamp from the future or
    // before boot means this phone's sensor uses another clock, so use now.
    val eventAt = if (event.timestamp in 1..elapsedNs) now - (elapsedNs - event.timestamp) / 1_000_000 else now
    val reading = StepAttribution.Reading(
      reading = event.values[0].toLong(),
      eventAt = eventAt,
      bootCount = bootCount(),
      bootAt = now - SystemClock.elapsedRealtime(),
      listeningSince = listeningSince,
      aliveUntil = previousAliveAt,
      now = now,
    )
    val result = StepAttribution.attribute(store.counterState(), reading)
    store.saveAttribution(result)
    result.untimed?.let {
      val f = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT)
      store.log("untimed", "${it.steps} steps between ${f.format(Date(it.fromMs))} and ${f.format(Date(it.toMs))} (${it.reason})")
    }
    if (result.discarded > 0) store.log("counter", "ignored an impossible jump of ${result.discarded} steps")
    firstReading?.countDown()

    // At most every 30 seconds, plus once after the steps stop so the last ones show.
    handler.removeCallbacks(refreshNotification)
    if (SystemClock.elapsedRealtime() - lastNotifiedElapsed > 30_000) updateNotification()
    handler.postDelayed(refreshNotification, 30_000)
  }

  private fun bootCount(): Long =
    Settings.Global.getInt(contentResolver, Settings.Global.BOOT_COUNT, -1).toLong()
      .takeIf { it >= 0 } ?: StepAttribution.UNKNOWN_BOOT

  private fun startOfToday(): Long =
    Calendar.getInstance().apply {
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }.timeInMillis

  private fun scheduleMidnight() {
    handler.removeCallbacks(atMidnight)
    val next = Calendar.getInstance().apply {
      add(Calendar.DAY_OF_YEAR, 1)
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 1)
      set(Calendar.MILLISECOND, 0)
    }.timeInMillis
    handler.postDelayed(atMidnight, (next - System.currentTimeMillis()).coerceAtLeast(1_000))
  }

  /** Today's steps from Google's recorder when it's in use (as the app shows), otherwise from this counter. */
  private fun updateNotification() {
    lastNotifiedElapsed = SystemClock.elapsedRealtime()
    val start = startOfToday()
    val now = System.currentTimeMillis()
    val since = store.getState(StepStore.RECORDER_SINCE, 0)
    val counted = { show(store.sum(start, now) + untimedToday(start, now)) }
    if (since in 1..start && StepRecorder.status(this) == "ready") {
      StepRecorder.total(this, start, now, onResult = { show(it) }, onError = { counted() })
    } else {
      counted()
    }
  }

  /** Steps with no known time that count for today: stretches that began today, as in the app. */
  private fun untimedToday(start: Long, now: Long): Long =
    store.untimed(start, now).sumOf {
      if ((it["from"] as Double).toLong() >= start) (it["steps"] as Double).toLong() else 0L
    }

  private fun show(steps: Long) {
    if (destroyed || steps == shownSteps) return
    shownSteps = steps
    getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification(steps))
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(CHANNEL_ID, "Step counting", NotificationManager.IMPORTANCE_LOW).apply {
      description = "Shows today's steps while the app counts them"
      setShowBadge(false)
    }
    getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  private fun buildNotification(steps: Long?): Notification {
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val tap = PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val icon = resources.getIdentifier("notification_icon", "drawable", packageName)
      .takeIf { it != 0 } ?: applicationInfo.icon
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(icon)
      .setContentTitle(if (steps == null) "Counting steps" else "${NumberFormat.getIntegerInstance().format(steps)} steps today")
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
    private const val BATCH_LATENCY_US = 60_000_000
    private const val HEARTBEAT_MS = 5 * 60_000L

    /** Released by the first reading (or flush) after a start, so the app can sync after it. */
    @Volatile private var firstReading: CountDownLatch? = null

    @Volatile var isRunning = false
      private set

    fun start(context: Context) {
      StepStore.get(context).setState(StepStore.ENABLED, 1)
      // Started with startForegroundService, the service has to go foreground,
      // and it can't without this permission: check here, before Android
      // would crash the app for not doing so. Counting resumes on the next
      // start once the permission is back.
      if (!canCount(context)) return
      val intent = Intent(context, StepCounterService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
    }

    /**
     * Starts counting if needed and waits (up to `timeoutMs`) for the
     * counter's first reading. Called on Expo's async thread, never the main one.
     */
    fun startAndWait(context: Context, timeoutMs: Long) {
      if (isRunning) return
      if (!canCount(context)) {
        start(context) // Remembers that counting is on, for when the permission is back.
        return
      }
      val latch = CountDownLatch(1)
      firstReading = latch
      try {
        start(context)
        latch.await(timeoutMs, TimeUnit.MILLISECONDS)
      } finally {
        if (firstReading === latch) firstReading = null
      }
    }

    fun canCount(context: Context) =
      Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED

    fun stop(context: Context) {
      StepStore.get(context).setState(StepStore.ENABLED, 0)
      context.stopService(Intent(context, StepCounterService::class.java))
    }
  }
}
