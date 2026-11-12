package expo.modules.passkeys

import android.app.Activity
import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.CreatePublicKeyCredentialResponse
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.PublicKeyCredential
import androidx.credentials.exceptions.CreateCredentialCancellationException
import androidx.credentials.exceptions.CreateCredentialException
import androidx.credentials.exceptions.CreateCredentialInterruptedException
import androidx.credentials.exceptions.CreateCredentialNoCreateOptionException
import androidx.credentials.exceptions.CreateCredentialProviderConfigurationException
import androidx.credentials.exceptions.CreateCredentialUnsupportedException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialInterruptedException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.GetCredentialUnsupportedException
import androidx.credentials.exceptions.NoCredentialException
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

// The codes modules/passkeys/passkeys.ts turns into its PasskeyErrorCode.
private const val CANCELLED = "ERR_PASSKEY_CANCELLED"
private const val NO_CREDENTIALS = "ERR_PASSKEY_NO_CREDENTIALS"
private const val NOT_SUPPORTED = "ERR_PASSKEY_NOT_SUPPORTED"
private const val INTERRUPTED = "ERR_PASSKEY_INTERRUPTED"
private const val FAILED = "ERR_PASSKEY_FAILED"

class PasskeyException(code: String, message: String, cause: Throwable? = null) :
  CodedException(code, message, cause)

/**
 * Passkeys through Android's Credential Manager: Google Password Manager (or
 * another provider the person picked) makes and keeps the key, unlocked by
 * the fingerprint or screen lock. The WebAuthn JSON passes through untouched;
 * the server checks it.
 */
class PasskeysModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Passkeys")

    // Credential Manager covers every Android version the app runs on (minSdk 28):
    // built in from Android 14, through Google Play services before that. Whether
    // this phone can really make one shows up as ERR_PASSKEY_NOT_SUPPORTED.
    Function("isSupported") { true }

    AsyncFunction("create") Coroutine { requestJson: String ->
      val activity = requireActivity()
      val response = try {
        // The sheet needs an Activity; run it the way Android's guide does, from the main thread.
        withContext(Dispatchers.Main) {
          CredentialManager.create(activity).createCredential(activity, CreatePublicKeyCredentialRequest(requestJson))
        }
      } catch (e: CancellationException) {
        throw e
      } catch (e: CreateCredentialException) {
        throw createError(e)
      } catch (e: Exception) {
        // IllegalArgumentException for request JSON Android won't accept (e.g. no user.name).
        throw PasskeyException(FAILED, "create: ${e.javaClass.simpleName}: ${e.message}", e)
      }
      (response as? CreatePublicKeyCredentialResponse)?.registrationResponseJson
        ?: throw PasskeyException(FAILED, "create: unexpected response ${response.type}")
    }

    AsyncFunction("get") Coroutine { requestJson: String ->
      val activity = requireActivity()
      val request = try {
        GetCredentialRequest.Builder()
          .addCredentialOption(GetPublicKeyCredentialOption(requestJson))
          // No Steps passkey on the phone: answer straight away instead of offering
          // another device's QR code, so the app can offer to make one.
          .setPreferImmediatelyAvailableCredentials(true)
          .build()
      } catch (e: Exception) {
        throw PasskeyException(FAILED, "get: ${e.javaClass.simpleName}: ${e.message}", e)
      }
      val response = try {
        withContext(Dispatchers.Main) {
          CredentialManager.create(activity).getCredential(activity, request)
        }
      } catch (e: CancellationException) {
        throw e
      } catch (e: GetCredentialException) {
        throw getError(e)
      } catch (e: Exception) {
        throw PasskeyException(FAILED, "get: ${e.javaClass.simpleName}: ${e.message}", e)
      }
      (response.credential as? PublicKeyCredential)?.authenticationResponseJson
        ?: throw PasskeyException(FAILED, "get: unexpected credential ${response.credential.type}")
    }
  }

  // Without an Activity (the app went to the background) there is nothing to show the sheet on.
  private fun requireActivity(): Activity =
    appContext.currentActivity ?: throw PasskeyException(INTERRUPTED, "No activity to show the passkey sheet on")

  private fun createError(e: CreateCredentialException): PasskeyException {
    val code = when (e) {
      is CreateCredentialCancellationException -> CANCELLED
      is CreateCredentialInterruptedException -> INTERRUPTED
      // No provider can save a passkey here: no screen lock, no Google account, or no Play services.
      is CreateCredentialNoCreateOptionException,
      is CreateCredentialProviderConfigurationException,
      is CreateCredentialUnsupportedException -> NOT_SUPPORTED
      // A DOM error (CreatePublicKeyCredentialDomException) is a real failure, never a quiet
      // cancel: androidx already turns Play services' "closed by the user" NotAllowedError into a
      // cancellation, and the rest (e.g. "request cannot be validated": assetlinks.json doesn't
      // match this app) must show, or a setup mistake looks like nothing happening.
      else -> FAILED
    }
    return PasskeyException(code, "create: ${e.type}: ${e.errorMessage ?: ""}", e)
  }

  private fun getError(e: GetCredentialException): PasskeyException {
    val code = when (e) {
      is GetCredentialCancellationException -> CANCELLED
      is NoCredentialException -> NO_CREDENTIALS
      is GetCredentialInterruptedException -> INTERRUPTED
      is GetCredentialProviderConfigurationException,
      is GetCredentialUnsupportedException -> NOT_SUPPORTED
      // DOM errors (GetPublicKeyCredentialDomException) fail loudly too; see createError.
      else -> FAILED
    }
    return PasskeyException(code, "get: ${e.type}: ${e.errorMessage ?: ""}", e)
  }
}
