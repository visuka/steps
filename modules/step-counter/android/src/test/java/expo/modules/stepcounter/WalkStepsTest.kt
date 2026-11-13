package expo.modules.stepcounter

import org.junit.Assert.assertEquals
import org.junit.Test

class WalkStepsTest {
  @Test
  fun aNewWalkStartsAtZero() {
    val s = WalkSteps.next(null, 52_000, 7)
    assertEquals(52_000, s.base)
    assertEquals(0, s.last)
  }

  @Test
  fun stepsCountFromTheBase() {
    var s = WalkSteps.next(null, 52_000, 7)
    s = WalkSteps.next(s, 52_120, 7)
    s = WalkSteps.next(s, 52_300, 7)
    assertEquals(300, s.last)
  }

  @Test
  fun aRestartSeenByBootCountCarriesOn() {
    var s = WalkSteps.next(null, 52_000, 7)
    s = WalkSteps.next(s, 52_800, 7)
    // Restarted, then 300 steps before the first reading: the counter is past the old base.
    s = WalkSteps.next(s, 52_100, 8)
    assertEquals(800, s.last)
    s = WalkSteps.next(s, 52_150, 8)
    assertEquals(850, s.last)
  }

  @Test
  fun aCounterBelowTheBaseIsARestartToo() {
    var s = WalkSteps.next(null, 52_000, WalkSteps.UNKNOWN_BOOT)
    s = WalkSteps.next(s, 52_500, WalkSteps.UNKNOWN_BOOT)
    s = WalkSteps.next(s, 40, WalkSteps.UNKNOWN_BOOT)
    assertEquals(500, s.last)
    s = WalkSteps.next(s, 100, WalkSteps.UNKNOWN_BOOT)
    assertEquals(560, s.last)
  }

  @Test
  fun neverGoesDown() {
    var s = WalkSteps.next(null, 1_000, 3)
    s = WalkSteps.next(s, 1_200, 3)
    s = WalkSteps.next(s, 1_150, 3)
    assertEquals(200, s.last)
  }
}
