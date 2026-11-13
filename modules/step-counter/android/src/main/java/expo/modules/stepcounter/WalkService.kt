package expo.modules.stepcounter

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorEventListener2
import android.hardware.SensorManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import com.google.android.gms.location.LocationRequest as GmsLocationRequest

/** The pin an indoor walk started at, from the JSON the app passed. */
internal data class PinnedPlace(val id: String, val name: String, val lat: Double, val lon: Double, val radiusM: Double) {
  companion object {
    fun parse(json: String?): PinnedPlace? {
      if (json.isNullOrBlank()) return null
      return try {
        val o = JSONObject(json)
        PinnedPlace(o.getString("id"), o.getString("name"), o.getDouble("lat"), o.getDouble("lon"), o.optDouble("radiusM", 100.0))
      } catch (e: Exception) {
        null
      }
    }
  }
}

/**
 * Records a walk or ride the person started in the app. Runs as a location
 * foreground service started while the app is open, which Android allows
 * with "while using the app" permission: no background location access.
 * Everything goes straight to SQLite (fixes, the walk's own step counter,
 * air pressure, Activity Recognition, indoor/outdoor switches), so it
 * survives the app being swiped away; the app reads it and does the maths.
 *
 * Outdoors: Google's fused location at high accuracy every 2 s (the platform
 * LocationManager when Play services are missing). Indoors at a pin: one
 * balanced-power fix a minute (every 20 s for the first 3 minutes); a fix
 * outside the pin asks for one high-accuracy fix, and only that confirms the
 * switch to the outdoor route. Indoor rides never start this service.
 *
 * Every call added for walks is wrapped: a failure never stops a recording.
 */
class WalkService : Service(), LocationListener {
  private lateinit var store: StepStore
  private lateinit var locationManager: LocationManager
  private lateinit var sensorManager: SensorManager
  private val handler = Handler(Looper.getMainLooper())
  private var fused: FusedLocationProviderClient? = null
  private var walkId = 0L
  private var isRide = false
  private var indoor = false
  private var place: PinnedPlace? = null
  private var distanceM = 0f
  private var lastGood: Location? = null
  private var lastNotifiedAt = 0L

  private var stepState: WalkSteps.State? = null
  private var walkSteps = 0L
  private var lastStepRowT = 0L
  private var pendingStepT = 0L
  private var pendingSteps = -1L

  private var pressureSum = 0.0
  private var pressureTimeSum = 0.0
  private var pressureCount = 0
  private var pressureBucketStart = 0L

  private var lastFixAt = 0L
  private var indoorSince = 0L
  private var indoorRequestMs = 0L
  private var indoorFallback = false
  private var confirming = false
  private var lastActivityConfirmAt = 0L
  @Volatile private var flushLatch: CountDownLatch? = null
  private var previousOutside = false
  private val logged = mutableSetOf<String>()

  private val fusedCallback = object : LocationCallback() {
    override fun onLocationResult(result: LocationResult) {
      for (location in result.locations) onFix(location, false)
    }
  }

  // SensorEventListener2 for onFlushCompleted: stopping waits for the batched events.
  private val stepListener = object : SensorEventListener2 {
    override fun onSensorChanged(event: SensorEvent) {
      try {
        onStepEvent(event)
      } catch (e: Exception) {
        logOnce("steps", e)
      }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    override fun onFlushCompleted(sensor: Sensor?) {
      flushLatch?.countDown()
    }
  }

  private val pressureListener = object : SensorEventListener2 {
    override fun onSensorChanged(event: SensorEvent) {
      try {
        onPressureEvent(event)
      } catch (e: Exception) {
        logOnce("pressure", e)
      }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    override fun onFlushCompleted(sensor: Sensor?) {
      flushLatch?.countDown()
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    store = StepStore.get(this)
    locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
    sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
    walkId = store.getState(StepStore.WALK_ID, 0)
    try {
      isRide = store.getState(StepStore.WALK_ACTIVITY, 0) == 1L
      indoor = store.getState(StepStore.WALK_INDOOR, 0) == 1L
      place = PinnedPlace.parse(store.getTextState(StepStore.WALK_PLACE))
      val base = store.getStateOrNull(StepStore.WALK_STEP_BASE)
      if (base != null) {
        stepState = WalkSteps.State(
          base,
          store.getState(StepStore.WALK_STEP_LAST, 0),
          store.getState(StepStore.WALK_STEP_BOOT, WalkSteps.UNKNOWN_BOOT),
        )
        walkSteps = stepState?.last ?: 0
      }
    } catch (e: Exception) {
      logOnce("state", e)
    }
    createChannel()
    try {
      ServiceCompat.startForeground(
        this,
        NOTIFICATION_ID,
        buildNotification(),
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0
      )
    } catch (e: Exception) {
      // Permission taken away: stop rather than crash. The app sees the walk
      // isn't recording and offers to save what there is.
      stopSelf()
      return
    }
    isRunning = true
    instance = this
    try {
      if (hasPlayServices(this)) fused = LocationServices.getFusedLocationProviderClient(this)
    } catch (e: Exception) {
      fused = null
    }
    indoorSince = System.currentTimeMillis()
    startLocation()
    startSensors()
    startActivityUpdates()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_NOT_STICKY

  override fun onDestroy() {
    writePending()
    try {
      sensorManager.unregisterListener(stepListener)
      sensorManager.unregisterListener(pressureListener)
    } catch (e: Exception) {
      logOnce("sensors", e)
    }
    stopLocation()
    stopActivityUpdates(this)
    handler.removeCallbacksAndMessages(null)
    if (instance === this) instance = null
    isRunning = false
    super.onDestroy()
  }

  // ---------------------------------------------------------------------------
  // Location.

  private fun indoorInterval(): Long =
    if (System.currentTimeMillis() - indoorSince < EARLY_CHECK_MS) INDOOR_EARLY_MS else INDOOR_MS

  @SuppressLint("MissingPermission")
  private fun startLocation() {
    stopLocation()
    if (walkId == 0L) return
    val interval = if (indoor) indoorInterval() else INTERVAL_MS
    val highAccuracy = !indoor || indoorFallback
    indoorRequestMs = if (indoor) interval else 0L
    val client = fused
    if (client != null) {
      try {
        val priority = if (highAccuracy) Priority.PRIORITY_HIGH_ACCURACY else Priority.PRIORITY_BALANCED_POWER_ACCURACY
        val request = GmsLocationRequest.Builder(priority, interval)
          .setMinUpdateDistanceMeters(0f)
          .setMinUpdateIntervalMillis(interval / 2)
          .build()
        client.requestLocationUpdates(request, fusedCallback, Looper.getMainLooper())
        return
      } catch (e: Exception) {
        logOnce("fused", e)
      }
    }
    // No Google Play services: the platform's providers, only ones the phone has.
    try {
      val providers = locationManager.allProviders
      if (indoor && !indoorFallback) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && providers.contains(LocationManager.FUSED_PROVIDER)) {
          val request = android.location.LocationRequest.Builder(interval)
            .setQuality(android.location.LocationRequest.QUALITY_BALANCED_POWER_ACCURACY)
            .build()
          locationManager.requestLocationUpdates(LocationManager.FUSED_PROVIDER, request, ContextCompat.getMainExecutor(this), this)
          return
        }
        if (providers.contains(LocationManager.NETWORK_PROVIDER)) {
          locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, interval, 0f, this, Looper.getMainLooper())
          return
        }
      }
      val provider = when {
        !indoor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && providers.contains(LocationManager.FUSED_PROVIDER) ->
          LocationManager.FUSED_PROVIDER
        providers.contains(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
        providers.contains(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
        else -> null
      }
      if (provider != null) locationManager.requestLocationUpdates(provider, interval, 0f, this, Looper.getMainLooper())
    } catch (e: Exception) {
      logOnce("location", e)
    }
  }

  private fun stopLocation() {
    try {
      fused?.removeLocationUpdates(fusedCallback)
    } catch (e: Exception) {
      logOnce("fused-stop", e)
    }
    try {
      locationManager.removeUpdates(this)
    } catch (e: Exception) {
      logOnce("location-stop", e)
    }
  }

  override fun onLocationChanged(location: Location) {
    onFix(location, false)
  }

  private fun onFix(location: Location, confirmingFix: Boolean) {
    try {
      if (walkId == 0L) return
      val now = System.currentTimeMillis()
      lastFixAt = now
      val t = if (location.time > 0) location.time else now
      val accuracy = if (location.hasAccuracy()) location.accuracy else null
      val speed = if (location.hasSpeed()) location.speed else null
      val speedAccuracy =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && location.hasSpeedAccuracy()) location.speedAccuracyMetersPerSecond else null
      val altitude = if (location.hasAltitude()) location.altitude else null
      store.addWalkPoint(walkId, t, location.latitude, location.longitude, accuracy, speed, speedAccuracy, altitude)
      if (indoor) {
        checkPlace(location, accuracy, confirmingFix, t)
        // After the first 3 minutes, back to one fix a minute.
        if (indoor && indoorRequestMs == INDOOR_EARLY_MS && now - indoorSince >= EARLY_CHECK_MS) startLocation()
      } else {
        addToDistance(location, accuracy)
      }
      maybeNotify(now)
    } catch (e: Exception) {
      logOnce("fix", e)
    }
  }

  /** A rough running distance for the notification; the app computes the real one. */
  private fun addToDistance(location: Location, accuracy: Float?) {
    if (accuracy != null && accuracy > 25f) return
    val previous = lastGood
    if (previous == null) {
      lastGood = location
      return
    }
    val moved = previous.distanceTo(location)
    if (moved >= 5f) {
      distanceM += moved
      lastGood = location
    }
  }

  private fun checkPlace(location: Location, accuracy: Float?, confirmingFix: Boolean, t: Long) {
    val pin = place ?: return
    val outside = PlaceCheck.isOutside(location.latitude, location.longitude, accuracy?.toDouble(), pin.lat, pin.lon, pin.radiusM)
    when (PlaceCheck.onIndoorFix(outside, confirmingFix, previousOutside, fused != null)) {
      PlaceCheck.Step.SWITCH -> switchMode(false, t)
      PlaceCheck.Step.CONFIRM -> confirmFix()
      PlaceCheck.Step.STAY -> Unit
    }
    if (!confirmingFix) previousOutside = outside
  }

  /** One high-accuracy fix, to confirm someone left the pin before turning on full GPS. */
  @SuppressLint("MissingPermission")
  private fun confirmFix() {
    val client = fused ?: return
    if (confirming) return
    confirming = true
    try {
      val cancel = CancellationTokenSource()
      handler.postDelayed({ cancel.cancel() }, CONFIRM_TIMEOUT_MS)
      client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cancel.token)
        .addOnSuccessListener { location ->
          confirming = false
          if (location != null && indoor) onFix(location, true)
        }
        .addOnFailureListener { confirming = false }
        .addOnCanceledListener { confirming = false }
    } catch (e: Exception) {
      confirming = false
      logOnce("confirm", e)
    }
  }

  /** Indoors to outdoors (leaving the pin, or "I'm outside now") and back ("I'm back inside"). Main thread. */
  internal fun switchMode(toIndoor: Boolean, t: Long) {
    try {
      if (isRide || indoor == toIndoor) return
      indoor = toIndoor
      store.setState(StepStore.WALK_INDOOR, if (toIndoor) 1L else 0L)
      store.addWalkMode(walkId, t, toIndoor)
      previousOutside = false
      indoorFallback = false
      lastGood = null
      if (toIndoor) indoorSince = System.currentTimeMillis()
      startLocation()
      getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification())
    } catch (e: Exception) {
      logOnce("switch", e)
    }
  }

  /** Indoors with no fix for 3 minutes (no network location here): GPS once a minute instead. */
  private fun checkIndoorFallback() {
    if (!indoor || indoorFallback) return
    val now = System.currentTimeMillis()
    if (now - maxOf(lastFixAt, indoorSince) >= NO_FIX_FALLBACK_MS) {
      indoorFallback = true
      store.log("walk", "no indoor fix for 3 min: GPS once a minute")
      startLocation()
    }
  }

  // Overridden explicitly: before Android 11 these aren't default methods, and a
  // provider change would otherwise crash the service.
  @Deprecated("Deprecated in Android")
  override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit

  override fun onProviderEnabled(provider: String) = Unit

  override fun onProviderDisabled(provider: String) = Unit

  // ---------------------------------------------------------------------------
  // Steps and pressure: rows driven by sensor events, never by a timer.

  private fun startSensors() {
    try {
      if (!isRide && StepCounterService.canCount(this)) {
        // Many phones have no wake-up step counter: fall back to the ordinary one.
        val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER, true)
          ?: sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        if (sensor != null) sensorManager.registerListener(stepListener, sensor, SensorManager.SENSOR_DELAY_NORMAL, STEP_LATENCY_US)
      }
    } catch (e: Exception) {
      logOnce("step-sensor", e)
    }
    try {
      // The wake-up barometer only if it can batch; otherwise it would wake the phone every second.
      val wakeUp = sensorManager.getDefaultSensor(Sensor.TYPE_PRESSURE, true)?.takeIf { it.fifoMaxEventCount > 0 }
      val sensor = wakeUp ?: sensorManager.getDefaultSensor(Sensor.TYPE_PRESSURE)
      if (sensor != null) sensorManager.registerListener(pressureListener, sensor, PRESSURE_PERIOD_US, PRESSURE_LATENCY_US)
    } catch (e: Exception) {
      logOnce("pressure-sensor", e)
    }
  }

  /** Batches arrive late: an event's own time, on the wall clock (now if the stamp is from another clock). */
  private fun eventTime(event: SensorEvent): Long {
    val now = System.currentTimeMillis()
    val elapsedNs = SystemClock.elapsedRealtimeNanos()
    return if (event.timestamp in 1..elapsedNs) now - (elapsedNs - event.timestamp) / 1_000_000 else now
  }

  private fun bootCount(): Long =
    Settings.Global.getInt(contentResolver, Settings.Global.BOOT_COUNT, -1).toLong()
      .takeIf { it >= 0 } ?: WalkSteps.UNKNOWN_BOOT

  private fun onStepEvent(event: SensorEvent) {
    if (walkId == 0L) return
    val t = eventTime(event)
    val previous = stepState
    val next = WalkSteps.next(previous, event.values[0].toLong(), bootCount())
    stepState = next
    walkSteps = next.last
    if (previous == null || previous.base != next.base) saveStepState(next)
    pendingSteps = next.last
    pendingStepT = maxOf(t, lastStepRowT + 1)
    if (pendingStepT - lastStepRowT >= SAMPLE_MS) writeStepRow()
    checkIndoorFallback()
    maybeNotify(System.currentTimeMillis())
  }

  private fun saveStepState(state: WalkSteps.State) {
    store.setState(StepStore.WALK_STEP_BASE, state.base)
    store.setState(StepStore.WALK_STEP_LAST, state.last)
    store.setState(StepStore.WALK_STEP_BOOT, state.bootCount)
  }

  /** The last step row and pressure bucket. Main thread. */
  private fun writePending() {
    try {
      writeStepRow()
      flushPressure()
    } catch (e: Exception) {
      logOnce("flush", e)
    }
  }

  /**
   * Before stopping, off the main thread: has the sensors deliver what they
   * batched (up to 5 s of steps), then writes the last rows on the main
   * thread, so the app's read straight after stop sees all of it. onDestroy
   * runs later, after the app has already read.
   */
  internal fun flushBeforeStop() {
    if (Looper.myLooper() == Looper.getMainLooper()) {
      // Can't wait here: the flush results arrive on this thread.
      writePending()
      return
    }
    try {
      val flushed = CountDownLatch(2)
      flushLatch = flushed
      if (!runCatching { sensorManager.flush(stepListener) }.getOrDefault(false)) flushed.countDown()
      if (!runCatching { sensorManager.flush(pressureListener) }.getOrDefault(false)) flushed.countDown()
      flushed.await(FLUSH_WAIT_MS, TimeUnit.MILLISECONDS)
    } catch (e: Exception) {
      logOnce("sensor-flush", e)
    } finally {
      flushLatch = null
    }
    val written = CountDownLatch(1)
    handler.post {
      try {
        writePending()
      } finally {
        written.countDown()
      }
    }
    runCatching { written.await(FLUSH_WAIT_MS, TimeUnit.MILLISECONDS) }
  }

  private fun writeStepRow() {
    if (pendingSteps < 0 || walkId == 0L) return
    store.addWalkSteps(walkId, pendingStepT, pendingSteps)
    stepState?.let { saveStepState(it) }
    store.setState(StepStore.WALK_LAST_ALIVE, System.currentTimeMillis())
    lastStepRowT = pendingStepT
    pendingSteps = -1
  }

  private fun onPressureEvent(event: SensorEvent) {
    if (walkId == 0L) return
    val t = eventTime(event)
    val hpa = event.values[0].toDouble()
    if (hpa < 300.0 || hpa > 1100.0) return
    if (pressureCount > 0 && t - pressureBucketStart >= SAMPLE_MS) flushPressure()
    if (pressureCount == 0) pressureBucketStart = t
    pressureSum += hpa
    pressureTimeSum += t.toDouble()
    pressureCount += 1
    checkIndoorFallback()
  }

  /** Writes the mean of the readings so far as one row. */
  private fun flushPressure() {
    if (pressureCount == 0 || walkId == 0L) return
    store.addWalkPressure(walkId, (pressureTimeSum / pressureCount).toLong(), pressureSum / pressureCount)
    store.setState(StepStore.WALK_LAST_ALIVE, System.currentTimeMillis())
    pressureSum = 0.0
    pressureTimeSum = 0.0
    pressureCount = 0
  }

  // ---------------------------------------------------------------------------
  // Activity Recognition.

  @SuppressLint("MissingPermission")
  private fun startActivityUpdates() {
    if (fused == null || !StepCounterService.canCount(this)) return
    try {
      ActivityRecognition.getClient(this)
        .requestActivityUpdates(AR_INTERVAL_MS, activityIntent(this))
        .addOnFailureListener { e -> logOnce("activity", e) }
    } catch (e: Exception) {
      logOnce("activity", e)
    }
  }

  /** From the receiver, on the main thread. Vehicle or bicycle while indoors asks for a confirming fix. */
  internal fun handleActivity(vehicleConf: Int, bicycleConf: Int) {
    try {
      store.setState(StepStore.WALK_LAST_ALIVE, System.currentTimeMillis())
      if (!indoor || place == null || !PlaceCheck.shouldConfirmForActivity(vehicleConf, bicycleConf)) return
      val now = System.currentTimeMillis()
      if (confirming || !PlaceCheck.activityConfirmDue(now, lastActivityConfirmAt)) return
      lastActivityConfirmAt = now
      confirmFix()
    } catch (e: Exception) {
      logOnce("activity-result", e)
    }
  }

  // ---------------------------------------------------------------------------
  // Notification.

  private fun maybeNotify(now: Long) {
    if (now - lastNotifiedAt <= 10_000) return
    lastNotifiedAt = now
    try {
      getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification())
    } catch (e: Exception) {
      logOnce("notify", e)
    }
  }

  private fun logOnce(what: String, e: Exception) {
    if (!logged.add(what)) return
    runCatching { store.log("walk", "$what failed: ${e.javaClass.simpleName}") }
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(CHANNEL_ID, "Walk recording", NotificationManager.IMPORTANCE_LOW).apply {
      description = "Shows a walk you're recording"
      setShowBadge(false)
    }
    getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification {
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val tap = PendingIntent.getActivity(this, 1, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val icon = resources.getIdentifier("notification_icon", "drawable", packageName)
      .takeIf { it != 0 } ?: applicationInfo.icon
    val title = if (isRide) "Recording your ride" else "Recording your walk"
    val text = if (!isRide && indoor) {
      val steps = NumberFormat.getIntegerInstance().format(walkSteps)
      val where = place?.name
      if (where != null) "Indoor walk at $where · $steps steps" else "Indoor walk · $steps steps"
    } else {
      String.format(Locale.US, "%.2f km so far. Open the app to stop.", distanceM / 1000f)
    }
    // The lock screen shows only the public version, never the name of the place.
    val publicVersion = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(icon)
      .setContentTitle(title)
      .setContentIntent(tap)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(icon)
      .setContentTitle(title)
      .setContentText(text)
      .setContentIntent(tap)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setUsesChronometer(true)
      .setWhen(if (walkId != 0L) walkId else System.currentTimeMillis())
      .setShowWhen(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setPublicVersion(publicVersion)
      .build()
  }

  companion object {
    private const val CHANNEL_ID = "walk-recording"
    private const val NOTIFICATION_ID = 7002
    private const val INTERVAL_MS = 2_000L
    private const val INDOOR_MS = 60_000L
    private const val INDOOR_EARLY_MS = 20_000L
    private const val EARLY_CHECK_MS = 3 * 60_000L
    private const val NO_FIX_FALLBACK_MS = 3 * 60_000L
    private const val CONFIRM_TIMEOUT_MS = 30_000L
    private const val SAMPLE_MS = 5_000L
    private const val STEP_LATENCY_US = 5_000_000
    private const val PRESSURE_PERIOD_US = 1_000_000
    private const val PRESSURE_LATENCY_US = 10_000_000
    private const val AR_INTERVAL_MS = 10_000L
    private const val AR_REQUEST_CODE = 7003
    private const val FLUSH_WAIT_MS = 1_500L

    @Volatile var isRunning = false
      private set

    @Volatile private var instance: WalkService? = null

    private fun hasPlayServices(context: Context): Boolean =
      try {
        GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS
      } catch (e: Exception) {
        false
      }

    private fun requireLocation(context: Context) {
      val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
      val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION)
      // Checked here because a service started this way must go foreground, and can't without it.
      if (fine != PackageManager.PERMISSION_GRANTED && coarse != PackageManager.PERMISSION_GRANTED) {
        throw SecurityException("Location permission is needed to record a walk")
      }
    }

    /**
     * Starts recording (or keeps the one in progress, in its stored mode);
     * resolves the start time. An indoor ride runs no service: its state is
     * the recording, so it needs no location permission.
     */
    fun start(context: Context, activity: String, indoor: Boolean, placeJson: String?, effort: String?): Long {
      val store = StepStore.get(context)
      var walkId = store.getState(StepStore.WALK_ID, 0)
      val ride: Boolean
      val indoorNow: Boolean
      if (walkId == 0L) {
        ride = activity == "ride"
        indoorNow = indoor
        if (!(ride && indoorNow)) requireLocation(context)
        walkId = System.currentTimeMillis()
        store.startWalkState(walkId, ride, indoorNow, placeJson, if (ride) effort else null)
      } else {
        // Carry on: the stored mode wins.
        ride = store.getState(StepStore.WALK_ACTIVITY, 0) == 1L
        indoorNow = store.getState(StepStore.WALK_INDOOR, 0) == 1L
        if (!(ride && indoorNow)) requireLocation(context)
        store.setState(StepStore.WALK_STOPPED, 0)
      }
      if (ride && indoorNow) return walkId
      if (!isRunning) {
        val intent = Intent(context, WalkService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
      }
      return walkId
    }

    fun stop(context: Context) {
      runCatching { StepStore.get(context).setState(StepStore.WALK_STOPPED, System.currentTimeMillis()) }
      instance?.let { service -> runCatching { service.flushBeforeStop() } }
      context.stopService(Intent(context, WalkService::class.java))
    }

    /** The service is running, or an indoor ride (no service) hasn't been stopped. */
    fun isRecording(context: Context): Boolean {
      if (isRunning) return true
      return try {
        val store = StepStore.get(context)
        store.getState(StepStore.WALK_ID, 0) != 0L &&
          store.getState(StepStore.WALK_ACTIVITY, 0) == 1L &&
          store.getState(StepStore.WALK_INDOOR, 0) == 1L &&
          store.getState(StepStore.WALK_STOPPED, 0) == 0L
      } catch (e: Exception) {
        false
      }
    }

    /** "I'm outside now" / "I'm back inside". Called on Expo's thread: the change runs on the main one. */
    fun setIndoor(context: Context, toIndoor: Boolean) {
      val app = context.applicationContext
      Handler(Looper.getMainLooper()).post {
        try {
          val store = StepStore.get(app)
          val walkId = store.getState(StepStore.WALK_ID, 0)
          if (walkId == 0L || store.getState(StepStore.WALK_ACTIVITY, 0) == 1L) return@post
          val service = instance
          if (isRunning && service != null) {
            service.switchMode(toIndoor, System.currentTimeMillis())
          } else if ((store.getState(StepStore.WALK_INDOOR, 0) == 1L) != toIndoor) {
            // Not running (interrupted): remember it for "carry on".
            store.setState(StepStore.WALK_INDOOR, if (toIndoor) 1L else 0L)
            store.addWalkMode(walkId, System.currentTimeMillis(), toIndoor)
          }
        } catch (e: Exception) {
          runCatching { StepStore.get(app).log("walk", "mode change failed: ${e.javaClass.simpleName}") }
        }
      }
    }

    /** Hands an Activity Recognition result to the running service, on the main thread. */
    fun onActivity(vehicleConf: Int, bicycleConf: Int) {
      Handler(Looper.getMainLooper()).post { instance?.handleActivity(vehicleConf, bicycleConf) }
    }

    fun activityIntent(context: Context): PendingIntent {
      val intent = Intent(context, WalkActivityReceiver::class.java)
      // Activity Recognition fills the result into the intent, so it must be mutable on Android 12+.
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or
        (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
      return PendingIntent.getBroadcast(context, AR_REQUEST_CODE, intent, flags)
    }

    /** Updates sent to a PendingIntent outlive the process: always stop them explicitly. */
    @SuppressLint("MissingPermission")
    fun stopActivityUpdates(context: Context) {
      try {
        ActivityRecognition.getClient(context).removeActivityUpdates(activityIntent(context))
      } catch (e: Exception) {
        runCatching { StepStore.get(context).log("walk", "stopping activity updates failed: ${e.javaClass.simpleName}") }
      }
    }
  }
}
