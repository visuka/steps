package expo.modules.stepcounter

import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

/**
 * Decides when the steps in a step-counter reading were taken. The sensor
 * only reports a running total since boot, like an odometer, so a reading
 * says how many steps happened since the previous one, never when.
 *
 * While this app listens, the hardware hands steps over within its batch
 * window (a minute), so a reading's steps were taken just before it. When the
 * app wasn't listening for part of the time (Android or the phone maker's
 * battery saver stopped it, the phone restarted), the steps could be anywhere
 * in that stretch: they're kept as untimed, with the interval they must lie
 * in, instead of being pinned to the moment counting resumed.
 *
 * Pure, so it can be tested without a phone.
 */
object StepAttribution {
  /** Longest stretch treated as "just now": the one-minute batch window plus slack. */
  const val BATCH_WINDOW_MS = 3 * 60_000L

  /** Typical walking cadence, used to spread a batch over the minutes before it. */
  const val SPREAD_PER_MINUTE = 120L

  /** For a batch after a long quiet stretch, whose minute isn't exactly known: never fast enough to look brisk. */
  const val SLOW_SPREAD_PER_MINUTE = 90L

  /** Faster than anyone walks or runs for long. A batch above this rate didn't come from one window. */
  const val MAX_PER_MINUTE = 200L

  const val UNKNOWN_BOOT = -1L

  data class State(
    val reading: Long,
    /** Wall time of the last reading. */
    val eventAt: Long,
    /** Settings.Global.BOOT_COUNT when it was taken, or UNKNOWN_BOOT. */
    val bootCount: Long,
  )

  data class Reading(
    val reading: Long,
    /** Wall time of the event. */
    val eventAt: Long,
    val bootCount: Long,
    /** Wall time the phone booted. */
    val bootAt: Long,
    /** Wall time this process started listening. */
    val listeningSince: Long,
    /** Wall time the previous process was last seen listening (0 = not known). */
    val aliveUntil: Long = 0,
    /** Wall time now; the event can't be later. */
    val now: Long,
  )

  data class Untimed(val fromMs: Long, val toMs: Long, val steps: Long, val reason: String)

  data class Result(
    /** (minute since epoch, steps), each minute once. */
    val placed: List<Pair<Long, Long>>,
    val untimed: Untimed?,
    val next: State,
    /** Steps dropped as impossible (more than anyone could walk in the time), for the log. */
    val discarded: Long = 0,
  )

  fun attribute(prev: State?, r: Reading): Result {
    val rebooted = when {
      prev == null -> false
      prev.bootCount != UNKNOWN_BOOT && r.bootCount != UNKNOWN_BOOT -> prev.bootCount != r.bootCount
      // No boot count (first reading after upgrading): the phone booted after the last reading, or the count fell.
      else -> r.bootAt > prev.eventAt || r.reading < prev.reading
    }

    // The steps lie between the previous reading (or the boot, if the phone
    // restarted since) and this one. A clock that went backwards, or an event
    // stamped in the future, is pulled back into that range.
    val listenedThroughout = prev != null && !rebooted && r.listeningSince <= prev.eventAt
    val from = when {
      prev == null -> r.eventAt
      rebooted -> max(prev.eventAt, r.bootAt)
      // While the last process was alive it was listening, so no steps were missed before it stopped.
      !listenedThroughout -> max(prev.eventAt, r.aliveUntil - BATCH_WINDOW_MS)
      else -> prev.eventAt
    }.coerceAtMost(r.now)
    val to = r.eventAt.coerceIn(from, r.now)
    // The first event after the app starts listening can be the sensor's
    // cached one, stamped at the last step taken before; its count is still
    // current as of then. So the state is current from when listening began,
    // and the next walk isn't mistaken for steps from a pause.
    val next = State(r.reading, max(to, r.listeningSince.coerceAtMost(r.now)), r.bootCount)

    if (prev == null) return Result(emptyList(), null, next) // First reading: just a baseline.

    val delta = when {
      rebooted -> r.reading // Counted from zero since the boot.
      r.reading < prev.reading -> r.reading // The sensor hub restarted without a reboot.
      else -> r.reading - prev.reading
    }
    if (delta <= 0) return Result(emptyList(), null, next)

    val window = to - from
    // More than anyone could walk in the time (a counter that didn't reset on
    // a restart, say): a new baseline, not steps.
    if (delta > MAX_PER_MINUTE * max(1L, window / 60_000 + 1)) return Result(emptyList(), null, next, discarded = delta)

    if (window <= BATCH_WINDOW_MS) return Result(spread(delta, from, to), null, next)
    val fitsOneBatch = delta <= MAX_PER_MINUTE * (BATCH_WINDOW_MS / 60_000)
    if (listenedThroughout && fitsOneBatch) return Result(spread(delta, from, to, SLOW_SPREAD_PER_MINUTE), null, next)

    val reason = when {
      rebooted -> "phone restarted"
      !listenedThroughout -> "counting paused"
      else -> "too many steps for one reading"
    }
    return Result(emptyList(), Untimed(from, to, delta, reason), next)
  }

  /** Spreads `delta` steps at `pace` over the minutes just before `toMs`, never before `fromMs`. */
  fun spread(delta: Long, fromMs: Long, toMs: Long, pace: Long = SPREAD_PER_MINUTE): List<Pair<Long, Long>> {
    val endMinute = toMs / 60_000
    val available = endMinute - fromMs / 60_000 + 1
    val minutes = min(available, max(1L, ceil(delta / pace.toDouble()).toLong()))
    val perMinute = delta / minutes
    var remainder = delta - perMinute * minutes
    return (0 until minutes).map { i ->
      val extra = if (remainder > 0) 1L else 0L
      remainder -= extra
      (endMinute - i) to (perMinute + extra)
    }
  }
}
