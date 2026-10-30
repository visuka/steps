package expo.modules.stepcounter

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Restarts counting after a reboot, if the user had it on. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
    if (StepStore.get(context).getState(StepStore.ENABLED, 0) == 1L) {
      runCatching { StepCounterService.start(context) }
    }
  }
}
