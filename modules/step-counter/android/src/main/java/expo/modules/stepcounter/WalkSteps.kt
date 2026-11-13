package expo.modules.stepcounter

/**
 * The walk's own step count from TYPE_STEP_COUNTER, which reports steps since
 * the phone booted. The first reading of a walk is its base; a restart of the
 * phone (seen by Settings.Global.BOOT_COUNT, not by the counter going below
 * the base: after a restart and a few hundred steps it can already be past
 * it) starts a new base so the walk carries on from where it was.
 *
 * Pure, so it can be tested without a phone.
 */
object WalkSteps {
  const val UNKNOWN_BOOT = -1L

  data class State(
    /** Counter value that means "0 steps into the walk". Can be negative after a restart. */
    val base: Long,
    /** Walk steps so far. */
    val last: Long,
    val bootCount: Long,
  )

  fun next(state: State?, counter: Long, bootCount: Long): State {
    if (state == null) return State(base = counter, last = 0, bootCount = bootCount)
    val bootChanged = bootCount != UNKNOWN_BOOT && state.bootCount != UNKNOWN_BOOT && bootCount != state.bootCount
    if (bootChanged || counter < state.base) {
      // Steps since the restart weren't recorded as part of the walk: carry on from the last count.
      return State(base = counter - state.last, last = state.last, bootCount = bootCount)
    }
    return State(base = state.base, last = maxOf(state.last, counter - state.base), bootCount = bootCount)
  }
}
