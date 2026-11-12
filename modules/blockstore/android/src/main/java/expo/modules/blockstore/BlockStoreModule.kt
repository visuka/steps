package expo.modules.blockstore

import android.content.Context
import com.google.android.gms.auth.blockstore.Blockstore
import com.google.android.gms.auth.blockstore.BlockstoreClient
import com.google.android.gms.auth.blockstore.BlockstoreStatusCodes
import com.google.android.gms.auth.blockstore.DeleteBytesRequest
import com.google.android.gms.auth.blockstore.RetrieveBytesRequest
import com.google.android.gms.auth.blockstore.StoreBytesData
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// The codes modules/blockstore/blockstore.ts turns into its BlockStoreErrorCode.
private const val UNAVAILABLE = "ERR_BLOCKSTORE_UNAVAILABLE"
private const val TOO_BIG = "ERR_BLOCKSTORE_TOO_BIG"
private const val FAILED = "ERR_BLOCKSTORE_FAILED"

class BlockStoreException(code: String, message: String, cause: Throwable? = null) :
  CodedException(code, message, cause)

/**
 * Google Play services' Block Store: up to 16 small values per app, kept
 * outside the app's own data. They stay through an uninstall and reinstall
 * (when the person has Google backup on) and move to a new phone set up from
 * this one or from the Google backup. Only this app (same package and
 * signing key) can read what it stored.
 *
 * Values travel as text both ways and are stored as their UTF-8 bytes.
 * Nothing here logs a value: they are sign-in keys.
 */
class BlockStoreModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  private val client: BlockstoreClient
    get() = Blockstore.getClient(context)

  override fun definition() = ModuleDefinition {
    Name("BlockStore")

    // Block Store is part of Google Play services; phones without them can't keep anything.
    Function("isSupported") {
      GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS
    }

    AsyncFunction("store") { key: String, value: String, promise: Promise -> storeValue(key, value, promise) }

    AsyncFunction("retrieve") { key: String, promise: Promise -> retrieveValue(key, promise) }

    AsyncFunction("delete") { key: String, promise: Promise -> deleteValue(key, promise) }
  }

  private fun storeValue(key: String, value: String, promise: Promise) {
    try {
      val data = StoreBytesData.Builder()
        .setKey(key)
        .setBytes(value.toByteArray(Charsets.UTF_8))
        // Backed up with the phone's next Google backup, end-to-end encrypted
        // when the phone has a screen lock. Leaving it off would also delete
        // an earlier cloud copy at the next backup.
        .setShouldBackupToCloud(true)
        .build()
      client.storeBytes(data)
        .addOnSuccessListener { promise.resolve(true) }
        .addOnFailureListener { e -> promise.reject(blockStoreError("store", e)) }
    } catch (e: Exception) {
      promise.reject(blockStoreError("store", e))
    }
  }

  private fun retrieveValue(key: String, promise: Promise) {
    try {
      val request = RetrieveBytesRequest.Builder()
        .setKeys(listOf(key))
        .build()
      client.retrieveBytes(request)
        .addOnSuccessListener { response ->
          // No entry for the key: the map simply lacks it.
          val bytes = response.blockstoreDataMap[key]?.bytes
          promise.resolve(bytes?.let { String(it, Charsets.UTF_8) })
        }
        .addOnFailureListener { e -> promise.reject(blockStoreError("retrieve", e)) }
    } catch (e: Exception) {
      promise.reject(blockStoreError("retrieve", e))
    }
  }

  private fun deleteValue(key: String, promise: Promise) {
    try {
      val request = DeleteBytesRequest.Builder()
        .setKeys(listOf(key))
        .build()
      client.deleteBytes(request)
        // True when there was something to delete.
        .addOnSuccessListener { deleted -> promise.resolve(deleted == true) }
        .addOnFailureListener { e -> promise.reject(blockStoreError("delete", e)) }
    } catch (e: Exception) {
      promise.reject(blockStoreError("delete", e))
    }
  }

  // The message names the call and the status, never the value.
  private fun blockStoreError(call: String, e: Exception): BlockStoreException {
    val status = (e as? ApiException)?.statusCode
    val code = when (status) {
      BlockstoreStatusCodes.MAX_SIZE_EXCEEDED,
      BlockstoreStatusCodes.TOO_MANY_ENTRIES -> TOO_BIG
      // No Block Store on this phone, or Play services can't run it (missing, off, too old).
      BlockstoreStatusCodes.FEATURE_NOT_SUPPORTED,
      CommonStatusCodes.API_NOT_CONNECTED -> UNAVAILABLE
      else -> FAILED
    }
    val detail = if (status != null) "status $status" else e.javaClass.simpleName
    return BlockStoreException(code, "$call: $detail", e)
  }
}
