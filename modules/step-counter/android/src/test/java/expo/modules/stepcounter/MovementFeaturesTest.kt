package expo.modules.stepcounter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.PI
import kotlin.math.sin

/** The same cases as src/health/__tests__/movement-features.test.ts. */
class MovementFeaturesTest {
  private val g = 9.81

  private fun burst(seconds: Double, rate: Double, axes: (Double) -> DoubleArray): MovementFeatures.Burst {
    val n = Math.round(seconds * rate).toInt() + 1
    val t = DoubleArray(n)
    val x = DoubleArray(n)
    val y = DoubleArray(n)
    val z = DoubleArray(n)
    for (i in 0 until n) {
      t[i] = i / rate
      val a = axes(t[i])
      x[i] = a[0]
      y[i] = a[1]
      z[i] = a[2]
    }
    return MovementFeatures.Burst(t, x, y, z)
  }

  /** Tiny deterministic noise, so a test never depends on a random number. */
  private fun wobble(t: Double, k: Double) = 0.02 * sin(t * 37.3 * k + k)

  private val walking = burst(10.0, 25.0) { t ->
    doubleArrayOf(0.4 * sin(2 * PI * 2 * t + 1), wobble(t, 2.0), g + 3 * sin(2 * PI * 2 * t))
  }

  @Test
  fun walkingHasAHighRhythmAndASmallPush() {
    val f = MovementFeatures.compute(walking)
    assertTrue("rhythm ${f.rhythm}", f.rhythm > 0.9)
    assertTrue("push ${f.push}", f.push < 0.3)
    assertTrue("brake ${f.brake}", f.brake < 0.3)
    assertTrue("gain ${f.speedGained}", f.speedGained < 1.0)
    assertTrue("buzz ${f.buzz}", f.buzz < 0.1)
  }

  @Test
  fun aVehicleSpeedingUpGainsAboutTwelveMetresASecond() {
    val ramp = burst(10.0, 25.0) { t ->
      doubleArrayOf(if (t >= 1.5 && t < 7.5) 2.0 else 0.0, wobble(t, 5.0), g + wobble(t, 7.0))
    }
    val f = MovementFeatures.compute(ramp)
    assertTrue("gain ${f.speedGained}", f.speedGained > 8.0 && f.speedGained < 13.0)
    assertTrue("push ${f.push}", f.push > 1.2 && f.push < 2.2)
    assertTrue("rhythm ${f.rhythm}", f.rhythm < 0.5)
  }

  @Test
  fun aHardSlowDownAfterAGentlePushReadsAsBraking() {
    val both = burst(10.0, 25.0) { t ->
      doubleArrayOf(if (t >= 1.5 && t < 7.5) 0.5 else if (t >= 8.0 && t < 8.5) -4.0 else 0.0, 0.0, g)
    }
    val f = MovementFeatures.compute(both)
    assertTrue("brake ${f.brake} push ${f.push}", f.brake > f.push)
  }

  @Test
  fun shakingAt30HzIsBuzz() {
    val buzzing = burst(10.0, 100.0) { t ->
      doubleArrayOf(0.5 * sin(2 * PI * 30 * t), 0.0, g + 0.8 * sin(2 * PI * 30 * t + 2))
    }
    val f = MovementFeatures.compute(buzzing)
    assertTrue("buzz ${f.buzz}", f.buzz > 0.9)
  }

  // The phone is read at about 25 Hz, so the highest frequency it can see is 12.5 Hz.
  @Test
  fun shakingAt10HzReadAt25HzIsBuzz() {
    val buzzing = burst(10.0, 25.0) { t ->
      doubleArrayOf(0.5 * sin(2 * PI * 10 * t), 0.0, g + 0.8 * sin(2 * PI * 10 * t + 2))
    }
    val f = MovementFeatures.compute(buzzing)
    assertTrue("buzz ${f.buzz}", f.buzz > 0.9)
  }

  @Test
  fun shakingAt30HzReadAt25HzFoldsDownAndIsNotSeen() {
    val buzzing = burst(10.0, 25.0) { t ->
      doubleArrayOf(0.5 * sin(2 * PI * 30 * t), 0.0, g + 0.8 * sin(2 * PI * 30 * t + 2))
    }
    val f = MovementFeatures.compute(buzzing)
    assertTrue("buzz ${f.buzz}", f.buzz < 0.1)
  }

  @Test
  fun aPhoneThatHardlyShakesHasNoBuzzOrRhythm() {
    val still = burst(10.0, 25.0) { t -> doubleArrayOf(wobble(t, 1.0), wobble(t, 2.0), g + wobble(t, 3.0)) }
    val f = MovementFeatures.compute(still)
    assertEquals(0.0, f.buzz, 0.0)
    assertEquals(0.0, f.rhythm, 0.0)
  }

  @Test
  fun tooShortABurstGivesNothing() {
    assertEquals(MovementFeatures.NONE, MovementFeatures.compute(burst(2.0, 25.0) { doubleArrayOf(0.0, 0.0, g) }))
  }

  @Test
  fun smoothingASineOfWholePeriodsLeavesNothing() {
    val s = DoubleArray(101) { sin(2 * PI * 2 * it / 25) }
    val out = MovementFeatures.smooth(s, 50)
    assertTrue(Math.abs(out[50]) < 0.05)
  }
}
