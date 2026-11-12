package expo.modules.stepcounter

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Restarts counting after a reboot or an app update (an update stops the
 * app, and Android doesn't bring the counter back by itself), if the user
 * had it on. Some phone makers block these until "Auto launch" is allowed;
 * the counter then resumes when the app is opened, and the steps in between
 * are kept as untimed rather than lost or misplaced.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action !in ACTIONS) return
    if (StepStore.get(context).getState(StepStore.ENABLED, 0) == 1L) {
      runCatching { StepCounterService.start(context) }
        .onFailure { StepStore.get(context).log("counter", "restart after ${intent.action} failed: ${it.javaClass.simpleName}") }
    }
  }

  companion object {
    private val ACTIONS = setOf(
      Intent.ACTION_BOOT_COMPLETED,
      Intent.ACTION_MY_PACKAGE_REPLACED,
      "android.intent.action.QUICKBOOT_POWERON",
    )
  }
}
