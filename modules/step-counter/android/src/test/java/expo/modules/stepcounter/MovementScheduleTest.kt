package expo.modules.stepcounter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MovementScheduleTest {
  private val now = 10_000_000L
  private val fresh = now - 5_000L
  private val longAgo = now - MovementSchedule.MIN_GAP_MS - 1

  @Test
  fun newFreshStepsAfterTheGapAndNotStillSample() {
    assertTrue(MovementSchedule.shouldSample(now, fresh, 12, longAgo, false))
  }

  @Test
  fun noNewStepsNoBurst() {
    assertFalse(MovementSchedule.shouldSample(now, fresh, 0, longAgo, false))
    assertFalse(MovementSchedule.canSample(now, fresh, 0, longAgo))
  }

  @Test
  fun stepsHandedOverTooLateNoBurst() {
    assertTrue(MovementSchedule.shouldSample(now, now - MovementSchedule.FRESH_STEPS_MS, 5, longAgo, false))
    assertFalse(MovementSchedule.shouldSample(now, now - MovementSchedule.FRESH_STEPS_MS - 1, 5, longAgo, false))
  }

  @Test
  fun aBurstNeedsTheGap() {
    assertTrue(MovementSchedule.shouldSample(now, fresh, 5, now - MovementSchedule.MIN_GAP_MS, false))
    assertFalse(MovementSchedule.shouldSample(now, fresh, 5, now - MovementSchedule.MIN_GAP_MS + 1, false))
  }

  @Test
  fun stillStopsTheBurst() {
    assertFalse(MovementSchedule.shouldSample(now, fresh, 12, longAgo, true))
  }

  @Test
  fun stillIsOnlyAnEnterOfStill() {
    assertTrue(MovementSchedule.isStill("still", true, now - 1_000, now))
    assertFalse(MovementSchedule.isStill("still", false, now - 1_000, now))
    assertFalse(MovementSchedule.isStill("walking", true, now - 1_000, now))
    assertFalse(MovementSchedule.isStill(null, false, 0L, now))
  }

  @Test
  fun anOldStillNoLongerCounts() {
    assertTrue(MovementSchedule.isStill("still", true, now - MovementSchedule.STILL_VALID_MS, now))
    assertFalse(MovementSchedule.isStill("still", true, now - MovementSchedule.STILL_VALID_MS - 1, now))
  }

  @Test
  fun aStillFromTheFutureDoesNotCount() {
    assertFalse(MovementSchedule.isStill("still", true, now + 1, now))
  }

  @Test
  fun aBurstGoesStaleAfterItsLengthPlusExtra() {
    val limit = MovementSchedule.BURST_MS + MovementSchedule.STALE_EXTRA_MS
    assertFalse(MovementSchedule.isStale(1_000 + limit, 1_000))
    assertTrue(MovementSchedule.isStale(1_000 + limit + 1, 1_000))
  }

  @Test
  fun minuteOfRoundsDownAlsoBeforeTheEpoch() {
    assertEquals(0L, MovementSchedule.minuteOf(59_999))
    assertEquals(1L, MovementSchedule.minuteOf(60_000))
    assertEquals(-1L, MovementSchedule.minuteOf(-1))
  }

  @Test
  fun anEventStampOnTheBootClockBecomesWallClock() {
    // The event was 2 s ago.
    assertEquals(998_000L, MovementSchedule.wallClock(1_000_000L, 50_000_000_000L, 48_000_000_000L))
  }

  @Test
  fun aStampFromTheFutureOrZeroUsesNow() {
    assertEquals(1_000_000L, MovementSchedule.wallClock(1_000_000L, 50_000_000_000L, 50_000_000_001L))
    assertEquals(1_000_000L, MovementSchedule.wallClock(1_000_000L, 50_000_000_000L, 0L))
    assertEquals(1_000_000L, MovementSchedule.wallClock(1_000_000L, 50_000_000_000L, -5L))
  }

  @Test
  fun aStampExactlyNowIsNow() {
    assertEquals(1_000_000L, MovementSchedule.wallClock(1_000_000L, 50_000_000_000L, 50_000_000_000L))
  }
}
