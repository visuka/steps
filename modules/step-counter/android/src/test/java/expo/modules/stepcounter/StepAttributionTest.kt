package expo.modules.stepcounter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The counter's real-phone situations: batches while listening, a stopped app, restarts, clock changes. */
class StepAttributionTest {
  private val min = 60_000L
  private val hour = 60 * min
  /** Mon 12 Oct 2026 00:00 UTC, as a fixed origin. */
  private val day = 1_791_763_200_000L

  private fun reading(
    count: Long,
    at: Long,
    boot: Long = 7,
    bootAt: Long = day - 30 * 24 * hour,
    listeningSince: Long = day - 24 * hour,
    now: Long = at,
  ) = StepAttribution.Reading(count, at, boot, bootAt, listeningSince, now)

  private fun total(r: StepAttribution.Result) = r.placed.sumOf { it.second }

  @Test
  fun firstReadingIsOnlyABaseline() {
    val r = StepAttribution.attribute(null, reading(5_000, day + 9 * hour))
    assertEquals(0, total(r))
    assertNull(r.untimed)
    assertEquals(5_000, r.next.reading)
  }

  @Test
  fun aBatchWhileListeningLandsJustBeforeTheReading() {
    val prev = StepAttribution.State(5_000, day + 9 * hour, 7)
    val r = StepAttribution.attribute(prev, reading(5_090, day + 9 * hour + 50_000))
    assertEquals(90, total(r))
    assertEquals(listOf((day + 9 * hour) / min to 90L), r.placed)
  }

  @Test
  fun aWalkAfterHoursOfSittingIsTimedWhenTheAppListenedThroughout() {
    // Sat from 13:00, then walked; the hardware hands the first steps over within a minute.
    val prev = StepAttribution.State(5_000, day + 13 * hour, 7)
    val r = StepAttribution.attribute(prev, reading(5_150, day + 15 * hour + 30_000))
    assertEquals(150, total(r))
    assertNull(r.untimed)
    assertTrue(r.placed.all { it.first >= (day + 15 * hour) / min - 1 })
  }

  @Test
  fun stepsWhileTheAppWasStoppedAreUntimedNotPinnedToTheMorning() {
    // Last reading 23:00; the battery saver stopped the app; it listens again from 08:00.
    val prev = StepAttribution.State(6_000, day - hour, 7)
    val r = StepAttribution.attribute(
      prev,
      reading(7_100, day + 8 * hour + 20_000, listeningSince = day + 8 * hour),
    )
    assertEquals(0, total(r))
    val untimed = r.untimed!!
    assertEquals(1_100, untimed.steps)
    assertEquals(day - hour, untimed.fromMs)
    assertEquals(day + 8 * hour + 20_000, untimed.toMs)
    assertEquals("counting paused", untimed.reason)
  }

  @Test
  fun aRestartCountsFromBootAndNeverBeforeIt() {
    val prev = StepAttribution.State(9_800, day + 17 * hour, 7)
    val bootAt = day + 18 * hour
    val r = StepAttribution.attribute(
      prev,
      reading(3_050, day + 34 * hour, boot = 8, bootAt = bootAt, listeningSince = day + 34 * hour - min),
    )
    assertEquals(0, total(r))
    assertEquals(3_050, r.untimed!!.steps)
    assertEquals(bootAt, r.untimed!!.fromMs)
    assertEquals("phone restarted", r.untimed!!.reason)
  }

  @Test
  fun aRestartIsSeenEvenWhenTheNewCountIsHigher() {
    val prev = StepAttribution.State(1_200, day + 9 * hour, 7)
    val r = StepAttribution.attribute(prev, reading(5_000, day + 20 * hour, boot = 8, bootAt = day + 10 * hour))
    assertEquals(5_000, r.untimed!!.steps)
  }

  @Test
  fun aBigJumpWhileListeningIsUntimed() {
    val prev = StepAttribution.State(1_000, day + 9 * hour, 7)
    val r = StepAttribution.attribute(prev, reading(4_000, day + 12 * hour))
    assertEquals(0, total(r))
    assertEquals("too many steps for one reading", r.untimed!!.reason)
  }

  @Test
  fun aShortGapIsTimedEvenAfterARestartOfTheApp() {
    val prev = StepAttribution.State(1_000, day + 9 * hour, 7)
    val r = StepAttribution.attribute(
      prev,
      reading(1_200, day + 9 * hour + 2 * min, listeningSince = day + 9 * hour + min),
    )
    assertEquals(200, total(r))
    assertTrue(r.placed.all { it.first >= (day + 9 * hour) / min })
  }

  @Test
  fun aClockMovedBackKeepsStepsAtOrBeforeNow() {
    val prev = StepAttribution.State(1_000, day + 10 * hour, 7)
    val now = day + 9 * hour
    val r = StepAttribution.attribute(prev, reading(1_050, day + 10 * hour + min, now = now))
    assertEquals(50, total(r))
    assertTrue(r.placed.all { it.first <= now / min })
    assertTrue(r.next.eventAt <= now)
  }

  @Test
  fun anEventStampedInTheFutureIsBroughtBackToNow() {
    val prev = StepAttribution.State(1_000, day + 9 * hour, 7)
    val now = day + 9 * hour + min
    val r = StepAttribution.attribute(prev, reading(1_040, now + 5 * hour, now = now))
    assertEquals(40, total(r))
    assertEquals(now, r.next.eventAt)
  }

  @Test
  fun unknownBootCountFallsBackToTheCounterGoingDown() {
    val prev = StepAttribution.State(9_000, day + 9 * hour, StepAttribution.UNKNOWN_BOOT)
    val r = StepAttribution.attribute(prev, reading(300, day + 20 * hour, boot = StepAttribution.UNKNOWN_BOOT))
    assertEquals(300, r.untimed!!.steps)
  }

  @Test
  fun aWalkAfterACachedFirstEventIsTimed() {
    // The app starts listening at 08:00; the sensor first replays its cached event, stamped 07:15.
    val prev = StepAttribution.State(6_000, day - hour, 7)
    val listening = day + 8 * hour
    val first = StepAttribution.attribute(
      prev,
      reading(7_100, day + 7 * hour + 15 * min, listeningSince = listening, now = listening + 1_000),
    )
    assertEquals(1_100, first.untimed!!.steps)
    assertEquals(listening, first.next.eventAt)
    // A walk at 09:00 is then known to be just now.
    val walk = StepAttribution.attribute(first.next, reading(7_200, day + 9 * hour, listeningSince = listening))
    assertNull(walk.untimed)
    assertEquals(100, total(walk))
  }

  @Test
  fun theLastSignOfLifeNarrowsAPause() {
    // Last steps 19:05; the counter was still alive at 23:30, then stopped; listening again from 08:00.
    val prev = StepAttribution.State(6_000, day - 5 * hour + 5 * min, 7)
    val r = StepAttribution.attribute(
      prev,
      StepAttribution.Reading(
        reading = 6_400,
        eventAt = day + 8 * hour + 20_000,
        bootCount = 7,
        bootAt = day - 30 * 24 * hour,
        listeningSince = day + 8 * hour,
        aliveUntil = day - 30 * min,
        now = day + 8 * hour + 20_000,
      ),
    )
    assertEquals(day - 30 * min - StepAttribution.BATCH_WINDOW_MS, r.untimed!!.fromMs)
  }

  @Test
  fun withoutABootCountABootAfterTheLastReadingIsARestart() {
    val prev = StepAttribution.State(1_200, day + 9 * hour, StepAttribution.UNKNOWN_BOOT)
    val r = StepAttribution.attribute(
      prev,
      reading(5_000, day + 20 * hour, boot = StepAttribution.UNKNOWN_BOOT, bootAt = day + 12 * hour),
    )
    assertEquals(5_000, r.untimed!!.steps)
    assertEquals(day + 12 * hour, r.untimed!!.fromMs)
  }

  @Test
  fun anImpossibleJumpIsANewBaselineNotSteps() {
    // A counter that kept its lifetime total through a restart.
    val prev = StepAttribution.State(1_000, day + 9 * hour, 7)
    val r = StepAttribution.attribute(prev, reading(2_000_000, day + 21 * hour, boot = 8, bootAt = day + 20 * hour))
    assertEquals(0, total(r))
    assertNull(r.untimed)
    assertEquals(2_000_000, r.discarded)
    assertEquals(2_000_000, r.next.reading)
  }

  @Test
  fun aBatchAfterAQuietStretchIsNeverMadeBrisk() {
    val prev = StepAttribution.State(5_000, day + 13 * hour, 7)
    val r = StepAttribution.attribute(prev, reading(5_500, day + 15 * hour))
    assertEquals(500, total(r))
    assertTrue(r.placed.all { it.second <= StepAttribution.SLOW_SPREAD_PER_MINUTE })
  }

  @Test
  fun spreadingNeverGoesBeforeTheStartOrAboveAWalkingPace() {
    val placed = StepAttribution.spread(500, day + 10 * hour, day + 10 * hour + 2 * min + 10_000)
    assertEquals(500, placed.sumOf { it.second })
    assertEquals(3, placed.size)
    assertTrue(placed.all { it.first >= (day + 10 * hour) / min })
    val slow = StepAttribution.spread(360, day, day + hour)
    assertTrue(slow.all { it.second <= StepAttribution.SPREAD_PER_MINUTE })
  }
}
