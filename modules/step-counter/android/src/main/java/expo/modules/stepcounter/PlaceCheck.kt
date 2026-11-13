package expo.modules.stepcounter

import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Whether an indoor walk at a pinned place has left it. The same rules as
 * src/lib/places.ts (isOutside); keep the two in step. Its own haversine,
 * because Location.distanceBetween doesn't run in JVM unit tests.
 *
 * Pure, so it can be tested without a phone.
 */
object PlaceCheck {
  private const val EARTH_RADIUS_M = 6_371_000.0

  enum class Step {
    /** Still at the pin. */
    STAY,
    /** Looks outside: ask for one high-accuracy fix before switching. */
    CONFIRM,
    /** Confirmed outside: switch to 2 s GPS and map the route. */
    SWITCH,
  }

  fun distanceM(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
    val dLat = Math.toRadians(lat2 - lat1)
    val dLon = Math.toRadians(lon2 - lon1)
    val h = sin(dLat / 2) * sin(dLat / 2) +
      cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2) * sin(dLon / 2)
    return 2 * EARTH_RADIUS_M * asin(min(1.0, sqrt(h)))
  }

  /**
   * Outside when farther than radius + min(acc, 50) with acc <= 100, or so far
   * that even the whole accuracy can't reach the pin (a 300 m fix 5 km away).
   */
  fun isOutside(lat: Double, lon: Double, accuracyM: Double?, placeLat: Double, placeLon: Double, radiusM: Double): Boolean {
    val d = distanceM(lat, lon, placeLat, placeLon)
    val acc = accuracyM ?: 50.0
    val slack = min(acc, 50.0)
    return (d > radiusM + slack && acc <= 100.0) || d - acc > radiusM
  }

  /**
   * What to do with a fix taken indoors. A routine low-power fix outside asks
   * for a high-accuracy one; only that confirming fix switches. Without a way
   * to ask (no Google Play services), two outside fixes in a row do.
   */
  fun onIndoorFix(outside: Boolean, confirming: Boolean, previousOutside: Boolean, canConfirm: Boolean): Step =
    when {
      !outside -> Step.STAY
      confirming -> Step.SWITCH
      canConfirm -> Step.CONFIRM
      previousOutside -> Step.SWITCH
      else -> Step.STAY
    }

  /** Activity Recognition saying vehicle or bicycle (75+) asks for a confirming fix; it never switches on its own. */
  fun shouldConfirmForActivity(vehicleConf: Int, bicycleConf: Int): Boolean = vehicleConf >= 75 || bicycleConf >= 75
}
