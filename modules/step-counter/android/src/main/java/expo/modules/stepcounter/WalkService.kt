package expo.modules.stepcounter

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import java.util.Locale

/**
 * Records the GPS route of a walk the person started in the app. Runs as a
 * location foreground service started while the app is open, which Android
 * allows with "while using the app" permission: no background location access.
 * Fixes go straight to SQLite, so the route survives the app being swiped away;
 * the app reads them, works out distance and calories, and saves the walk.
 */
class WalkService : Service(), LocationListener {
  private lateinit var store: StepStore
  private lateinit var locationManager: LocationManager
  private var walkId = 0L
  private var distanceM = 0f
  private var lastGood: Location? = null
  private var lastNotifiedAt = 0L

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    store = StepStore.get(this)
    locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
    walkId = store.getState(StepStore.WALK_ID, 0)
    createChannel()
    try {
      ServiceCompat.startForeground(
        this,
        NOTIFICATION_ID,
        buildNotification(),
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0
      )
      val provider =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && locationManager.allProviders.contains(LocationManager.FUSED_PROVIDER)) {
          LocationManager.FUSED_PROVIDER
        } else {
          LocationManager.GPS_PROVIDER
        }
      locationManager.requestLocationUpdates(provider, INTERVAL_MS, 0f, this, Looper.getMainLooper())
    } catch (e: Exception) {
      // Permission taken away, or no GPS: stop rather than crash. The app sees
      // the walk isn't recording and offers to save what there is.
      stopSelf()
      return
    }
    isRunning = true
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_NOT_STICKY

  override fun onDestroy() {
    locationManager.removeUpdates(this)
    isRunning = false
    super.onDestroy()
  }

  override fun onLocationChanged(location: Location) {
    if (walkId == 0L) return
    val accuracy = if (location.hasAccuracy()) location.accuracy else null
    store.addWalkPoint(walkId, location.time, location.latitude, location.longitude, accuracy)

    // A rough running distance for the notification; the app computes the real one.
    if (accuracy == null || accuracy <= 30f) {
      val previous = lastGood
      if (previous == null) {
        lastGood = location
      } else {
        val moved = previous.distanceTo(location)
        if (moved >= 5f) {
          distanceM += moved
          lastGood = location
        }
      }
    }
    val now = System.currentTimeMillis()
    if (now - lastNotifiedAt > 10_000) {
      lastNotifiedAt = now
      getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification())
    }
  }

  // Overridden explicitly: before Android 11 these aren't default methods, and a
  // provider change would otherwise crash the service.
  @Deprecated("Deprecated in Android")
  override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit

  override fun onProviderEnabled(provider: String) = Unit

  override fun onProviderDisabled(provider: String) = Unit

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
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(icon)
      .setContentTitle("Recording your walk")
      .setContentText(String.format(Locale.US, "%.2f km so far. Open the app to stop.", distanceM / 1000f))
      .setContentIntent(tap)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setUsesChronometer(true)
      .setWhen(if (walkId != 0L) walkId else System.currentTimeMillis())
      .setShowWhen(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }

  companion object {
    private const val CHANNEL_ID = "walk-recording"
    private const val NOTIFICATION_ID = 7002
    private const val INTERVAL_MS = 2_000L

    @Volatile var isRunning = false
      private set

    /** Starts recording (or keeps the walk already in progress); resolves the walk's start time. */
    fun start(context: Context): Long {
      val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
      val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION)
      // Checked here because a service started this way must go foreground, and can't without it.
      if (fine != PackageManager.PERMISSION_GRANTED && coarse != PackageManager.PERMISSION_GRANTED) {
        throw SecurityException("Location permission is needed to record a walk")
      }
      val store = StepStore.get(context)
      var walkId = store.getState(StepStore.WALK_ID, 0)
      if (walkId == 0L) {
        walkId = System.currentTimeMillis()
        store.setState(StepStore.WALK_ID, walkId)
      }
      if (!isRunning) {
        val intent = Intent(context, WalkService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
      }
      return walkId
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, WalkService::class.java))
    }
  }
}
