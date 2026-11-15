package expo.modules.stepcounter

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Per-minute movement figures from a short burst of accelerometer readings
 * (T18a: recorded, nothing removed). Pure, with no Android types, so it can
 * be tested without a phone. src/health/movement-features.ts has the same
 * maths with the same names; keep the two the same.
 *
 * Units: seconds, m/s^2, m/s. A burst is about 10 s at about 25 Hz.
 *
 * 1. Gravity is a slow low-pass of the readings (seeded by the first second),
 *    so what is left is the phone's own movement, split into up-down (along
 *    gravity) and sideways (the flat plane).
 * 2. Rhythm: how well the up-down signal repeats at a step period (0.3 to 1 s).
 * 3. The sideways signal is smoothed over 2 s (footstep jolts cancel), then
 *    projected on its main direction. Forward is the direction in which the
 *    speed grew most; push is the strongest speed-up, braking the hardest slow-down.
 * 4. Speed gained: the smoothed forward acceleration added up over 5 s and
 *    over 10 s windows (restarted for each window); the largest change.
 * 5. Buzz: the share of the shaking energy at or above 6 Hz. At about 25 Hz
 *    the highest frequency that can be seen is 12.5 Hz, so buzz means 6 to 12.5 Hz;
 *    faster vibration folds down to a lower frequency and is not seen.
 */
object MovementFeatures {
  /** Seconds, increasing; x, y and z in m/s^2 as the accelerometer gives them (gravity included). */
  class Burst(val t: DoubleArray, val x: DoubleArray, val y: DoubleArray, val z: DoubleArray)

  data class Result(
    /** 0 to 1. */
    val rhythm: Double,
    /** Strongest forward speed-up, m/s^2 (0 or more). */
    val push: Double,
    /** Hardest slow-down, m/s^2 (0 or more). */
    val brake: Double,
    /** Largest speed change over a 5 s or 10 s window, m/s (0 or more). */
    val speedGained: Double,
    /** 0 to 1. */
    val buzz: Double,
  )

  const val GRAVITY_SEED_S = 1.0
  const val GRAVITY_TAU_S = 30.0
  const val SMOOTH_S = 2.0
  const val STEP_PERIOD_MIN_S = 0.3
  const val STEP_PERIOD_MAX_S = 1.0
  const val BUZZ_FROM_HZ = 6.0
  /** Below this up-down shaking (RMS, m/s^2) there is no rhythm to speak of. */
  const val MIN_SHAKE_RMS = 0.1
  /** Below this shaking over all axes (RMS, m/s^2) there is no buzz to speak of. */
  const val MIN_BUZZ_RMS = 0.2
  /** A burst shorter than this (s) or with fewer samples gives no figures. */
  const val MIN_BURST_S = 4.0
  const val MIN_SAMPLES = 40

  private val GAIN_WINDOWS_S = doubleArrayOf(5.0, 10.0)

  val NONE = Result(0.0, 0.0, 0.0, 0.0, 0.0)

  fun compute(burst: Burst): Result {
    val n = burst.t.size
    if (n < MIN_SAMPLES || burst.x.size != n || burst.y.size != n || burst.z.size != n) return NONE
    val span = burst.t[n - 1] - burst.t[0]
    if (!(span >= MIN_BURST_S)) return NONE
    val rate = (n - 1) / span

    val split = splitGravity(burst)
    val rhythm = rhythmScore(split.vertical, rate)
    val forward = forwardMotion(split.h1, split.h2, burst.t, rate)
    val buzz = buzzScore(burst, rate)
    return Result(rhythm, forward.push, forward.brake, forward.speedGained, buzz)
  }

  private class Split(val vertical: DoubleArray, val h1: DoubleArray, val h2: DoubleArray)

  private fun splitGravity(b: Burst): Split {
    val n = b.t.size
    var seedEnd = 1
    for (i in 0 until n) {
      if (b.t[i] - b.t[0] >= GRAVITY_SEED_S) {
        seedEnd = max(1, i)
        break
      }
    }
    var gx = 0.0
    var gy = 0.0
    var gz = 0.0
    for (i in 0 until seedEnd) {
      gx += b.x[i]
      gy += b.y[i]
      gz += b.z[i]
    }
    gx /= seedEnd
    gy /= seedEnd
    gz /= seedEnd

    // Two axes across the flat plane, from the seed's gravity direction.
    var g0 = sqrt(gx * gx + gy * gy + gz * gz)
    if (g0 == 0.0) g0 = 1.0
    val ux = gx / g0
    val uy = gy / g0
    val uz = gz / g0
    // Cross gravity with the device axis that is least along it.
    val ax = if (abs(ux) <= abs(uy) && abs(ux) <= abs(uz)) 1.0 else 0.0
    val ay = if (ax == 0.0 && abs(uy) <= abs(uz)) 1.0 else 0.0
    val az = if (ax == 0.0 && ay == 0.0) 1.0 else 0.0
    var e1x = uy * az - uz * ay
    var e1y = uz * ax - ux * az
    var e1z = ux * ay - uy * ax
    var e1n = sqrt(e1x * e1x + e1y * e1y + e1z * e1z)
    if (e1n == 0.0) e1n = 1.0
    e1x /= e1n
    e1y /= e1n
    e1z /= e1n
    val e2x = uy * e1z - uz * e1y
    val e2y = uz * e1x - ux * e1z
    val e2z = ux * e1y - uy * e1x

    val vertical = DoubleArray(n)
    val h1 = DoubleArray(n)
    val h2 = DoubleArray(n)
    for (i in 0 until n) {
      if (i > 0) {
        val dt = b.t[i] - b.t[i - 1]
        val a = dt / (GRAVITY_TAU_S + dt)
        gx += a * (b.x[i] - gx)
        gy += a * (b.y[i] - gy)
        gz += a * (b.z[i] - gz)
      }
      var gn = sqrt(gx * gx + gy * gy + gz * gz)
      if (gn == 0.0) gn = 1.0
      val dx = gx / gn
      val dy = gy / gn
      val dz = gz / gn
      val lx = b.x[i] - gx
      val ly = b.y[i] - gy
      val lz = b.z[i] - gz
      val up = lx * dx + ly * dy + lz * dz
      vertical[i] = up
      val hx = lx - up * dx
      val hy = ly - up * dy
      val hz = lz - up * dz
      h1[i] = hx * e1x + hy * e1y + hz * e1z
      h2[i] = hx * e2x + hy * e2y + hz * e2z
    }
    return Split(vertical, h1, h2)
  }

  /** The best autocorrelation (0 to 1) at a lag of a step period, 0.3 to 1 s. */
  fun rhythmScore(vertical: DoubleArray, rate: Double): Double {
    val n = vertical.size
    var mean = 0.0
    for (v in vertical) mean += v
    mean /= n
    val d = DoubleArray(n) { vertical[it] - mean }
    var energy = 0.0
    for (v in d) energy += v * v
    if (sqrt(energy / n) < MIN_SHAKE_RMS) return 0.0
    val minLag = max(1, (STEP_PERIOD_MIN_S * rate).roundToInt())
    val maxLag = min(n - 2, (STEP_PERIOD_MAX_S * rate).roundToInt())
    var best = 0.0
    for (lag in minLag..maxLag) {
      var sum = 0.0
      var a = 0.0
      var b = 0.0
      for (i in 0 until n - lag) {
        sum += d[i] * d[i + lag]
        a += d[i] * d[i]
        b += d[i + lag] * d[i + lag]
      }
      val r = if (a > 0 && b > 0) sum / sqrt(a * b) else 0.0
      if (r > best) best = r
    }
    return min(1.0, best)
  }

  /** Moving average over `width` samples around each one; the ends use what exists. */
  fun smooth(values: DoubleArray, width: Int): DoubleArray {
    val n = values.size
    val half = max(0, floor(width / 2.0).toInt())
    val prefix = DoubleArray(n + 1)
    for (i in 0 until n) prefix[i + 1] = prefix[i] + values[i]
    val out = DoubleArray(n)
    for (i in 0 until n) {
      val from = max(0, i - half)
      val to = min(n - 1, i + half)
      out[i] = (prefix[to + 1] - prefix[from]) / (to - from + 1)
    }
    return out
  }

  private class Forward(val push: Double, val brake: Double, val speedGained: Double)

  private fun forwardMotion(h1: DoubleArray, h2: DoubleArray, t: DoubleArray, rate: Double): Forward {
    val n = t.size
    val width = max(1, (SMOOTH_S * rate).roundToInt())
    val s1 = smooth(h1, width)
    val s2 = smooth(h2, width)
    // Main direction of the smoothed sideways acceleration.
    var c11 = 0.0
    var c22 = 0.0
    var c12 = 0.0
    for (i in 0 until n) {
      c11 += s1[i] * s1[i]
      c22 += s2[i] * s2[i]
      c12 += s1[i] * s2[i]
    }
    val theta = 0.5 * atan2(2 * c12, c11 - c22)
    val cs = cos(theta)
    val sn = sin(theta)
    val p = DoubleArray(n) { s1[it] * cs + s2[it] * sn }

    // Speed from the start, by the trapezoid rule; a window's change is the difference of two points.
    val speed = DoubleArray(n)
    for (i in 1 until n) speed[i] = speed[i - 1] + 0.5 * (p[i] + p[i - 1]) * (t[i] - t[i - 1])

    var bestChange = 0.0
    for (w in GAIN_WINDOWS_S) {
      var j = 0
      for (i in 0 until n) {
        if (j < i) j = i
        while (j < n && t[j] - t[i] < w) j++
        if (j >= n) break
        val change = speed[j] - speed[i]
        if (abs(change) > abs(bestChange)) bestChange = change
      }
    }
    // Forward is the way the speed grew most.
    val sign = if (bestChange < 0) -1.0 else 1.0
    var push = 0.0
    var brake = 0.0
    for (i in 0 until n) {
      val f = sign * p[i]
      if (f > push) push = f
      if (-f > brake) brake = -f
    }
    return Forward(push, brake, abs(bestChange))
  }

  /** Share of the shaking energy at or above BUZZ_FROM_HZ (0 to 1); 0 when hardly shaking. */
  fun buzzScore(b: Burst, rate: Double): Double {
    val n = b.t.size
    var high = 0.0
    var all = 0.0
    var variance = 0.0
    for (axis in arrayOf(b.x, b.y, b.z)) {
      var mean = 0.0
      for (v in axis) mean += v
      mean /= n
      val windowed = DoubleArray(n) { (axis[it] - mean) * (0.5 - 0.5 * cos(2 * PI * it / (n - 1))) }
      for (v in axis) variance += (v - mean) * (v - mean)
      val bins = n / 2
      for (k in 1..bins) {
        val step = 2 * PI * k / n
        var re = 0.0
        var im = 0.0
        for (i in 0 until n) {
          re += windowed[i] * cos(step * i)
          im -= windowed[i] * sin(step * i)
        }
        val power = re * re + im * im
        all += power
        if (k * rate / n >= BUZZ_FROM_HZ) high += power
      }
    }
    if (sqrt(variance / n) < MIN_BUZZ_RMS || all <= 0.0) return 0.0
    return min(1.0, high / all)
  }
}
