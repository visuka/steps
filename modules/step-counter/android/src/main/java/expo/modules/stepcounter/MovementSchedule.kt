package expo.modules.stepcounter

/**
 * When the accelerometer may be read (T18a). Pure, so it can be tested
 * without a phone. A burst starts only when the step counter just reported
 * new steps, no burst ran lately, and Android doesn't say the phone is still.
 */
object MovementSchedule {
  /** How long a burst reads the accelerometer. */
  const val BURST_MS = 10_000L
  /** At most one burst this often: about one a minute. */
  const val MIN_GAP_MS = 45_000L
  /** The steps must be this recent; the counter may hand them over up to a minute late. */
  const val FRESH_STEPS_MS = 90_000L

  /** "Still" counts for this long; after that the steps win (a dropped registration must not stop bursts for good). */
  const val STILL_VALID_MS = 10 * 60_000L
  /** A burst that has run this long past its length is stale (measured on the boot clock, which runs in deep sleep). */
  const val STALE_EXTRA_MS = 5_000L

  /** The cheap rules (no database): new, fresh steps and the gap since the last burst. */
  fun canSample(nowMs: Long, stepsAtMs: Long, stepsDelta: Long, lastBurstAtMs: Long): Boolean =
    stepsDelta > 0 &&
      nowMs - stepsAtMs <= FRESH_STEPS_MS &&
      nowMs - lastBurstAtMs >= MIN_GAP_MS

  fun shouldSample(nowMs: Long, stepsAtMs: Long, stepsDelta: Long, lastBurstAtMs: Long, still: Boolean): Boolean =
    !still && canSample(nowMs, stepsAtMs, stepsDelta, lastBurstAtMs)

  /** Android's last activity change was "entered still", and it is recent enough to trust. */
  fun isStill(lastActivity: String?, lastEnter: Boolean, transitionAtMs: Long, nowMs: Long): Boolean =
    lastActivity == "still" && lastEnter && nowMs - transitionAtMs in 0..STILL_VALID_MS

  /** A burst started at startedElapsedMs has outlived its time. */
  fun isStale(nowElapsedMs: Long, startedElapsedMs: Long): Boolean =
    nowElapsedMs - startedElapsedMs > BURST_MS + STALE_EXTRA_MS

  fun minuteOf(ms: Long): Long = Math.floorDiv(ms, 60_000L)

  /** The wall-clock time of an event stamped on the boot clock. */
  fun wallClock(nowMs: Long, nowElapsedNs: Long, eventElapsedNs: Long): Long =
    if (eventElapsedNs in 1..nowElapsedNs) nowMs - (nowElapsedNs - eventElapsedNs) / 1_000_000 else nowMs
}
