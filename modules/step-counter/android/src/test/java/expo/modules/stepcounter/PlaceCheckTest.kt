package expo.modules.stepcounter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaceCheckTest {
  private val homeLat = 12.9716
  private val homeLon = 77.5946
  private val mPerDegLat = 111_195.0

  private fun north(m: Double) = homeLat + m / mPerDegLat

  @Test
  fun haversineMatchesADegree() {
    assertEquals(111_195.0, PlaceCheck.distanceM(12.0, 77.0, 13.0, 77.0), 100.0)
  }

  @Test
  fun insideTheRadiusIsNotOutside() {
    assertFalse(PlaceCheck.isOutside(north(60.0), homeLon, 15.0, homeLat, homeLon, 100.0))
  }

  @Test
  fun accuracyGivesSlackUpTo50m() {
    // 140 m away with 45 m accuracy: within 100 + 45.
    assertFalse(PlaceCheck.isOutside(north(140.0), homeLon, 45.0, homeLat, homeLon, 100.0))
    // 170 m away with 80 m accuracy: slack stops at 50.
    assertTrue(PlaceCheck.isOutside(north(170.0), homeLon, 80.0, homeLat, homeLon, 100.0))
  }

  @Test
  fun aVeryRoughFixFarAwayIsStillOutside() {
    // 300 m accuracy is over the 100 m limit, but 5 km minus 300 m is far past the radius.
    assertTrue(PlaceCheck.isOutside(north(5_000.0), homeLon, 300.0, homeLat, homeLon, 100.0))
    // A 300 m fix 250 m away can't tell.
    assertFalse(PlaceCheck.isOutside(north(250.0), homeLon, 300.0, homeLat, homeLon, 100.0))
  }

  @Test
  fun aRoutineFixAsksAndOnlyTheConfirmingFixSwitches() {
    assertEquals(PlaceCheck.Step.STAY, PlaceCheck.onIndoorFix(outside = false, confirming = false, previousOutside = true, canConfirm = true))
    assertEquals(PlaceCheck.Step.CONFIRM, PlaceCheck.onIndoorFix(outside = true, confirming = false, previousOutside = false, canConfirm = true))
    assertEquals(PlaceCheck.Step.SWITCH, PlaceCheck.onIndoorFix(outside = true, confirming = true, previousOutside = false, canConfirm = true))
    assertEquals(PlaceCheck.Step.STAY, PlaceCheck.onIndoorFix(outside = false, confirming = true, previousOutside = false, canConfirm = true))
  }

  @Test
  fun withoutPlayServicesTwoOutsideFixesInARowSwitch() {
    assertEquals(PlaceCheck.Step.STAY, PlaceCheck.onIndoorFix(outside = true, confirming = false, previousOutside = false, canConfirm = false))
    assertEquals(PlaceCheck.Step.SWITCH, PlaceCheck.onIndoorFix(outside = true, confirming = false, previousOutside = true, canConfirm = false))
  }

  @Test
  fun activityOnlyAsks() {
    assertTrue(PlaceCheck.shouldConfirmForActivity(80, 0))
    assertTrue(PlaceCheck.shouldConfirmForActivity(10, 76))
    assertFalse(PlaceCheck.shouldConfirmForActivity(70, 60))
  }

  @Test
  fun activityConfirmsAtMostEveryTwoMinutes() {
    val t = 1_000_000L
    assertTrue(PlaceCheck.activityConfirmDue(t, 0L))
    assertFalse(PlaceCheck.activityConfirmDue(t + 10_000, t))
    assertFalse(PlaceCheck.activityConfirmDue(t + 119_999, t))
    assertTrue(PlaceCheck.activityConfirmDue(t + 120_000, t))
  }
}
