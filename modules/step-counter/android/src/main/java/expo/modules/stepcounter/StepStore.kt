package expo.modules.stepcounter

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.io.File
import java.util.UUID

/**
 * Per-minute step counts plus the counter state needed to turn the sensor's
 * "steps since boot" into deltas, steps whose time isn't known, a short log
 * of what the counter did, and the GPS fixes of a walk being recorded. Lives
 * in its own small database so the services can write without the JS runtime.
 */
class StepStore(private val context: Context) :
  SQLiteOpenHelper(context.applicationContext, "step_counter.db", null, 3) {

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL("CREATE TABLE buckets (minute INTEGER PRIMARY KEY NOT NULL, steps INTEGER NOT NULL)")
    db.execSQL("CREATE TABLE state (key TEXT PRIMARY KEY NOT NULL, value INTEGER NOT NULL)")
    createWalkPoints(db)
    createUntimedAndLog(db)
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    if (oldVersion < 2) createWalkPoints(db)
    if (oldVersion < 3) createUntimedAndLog(db)
  }

  private fun createWalkPoints(db: SQLiteDatabase) {
    db.execSQL(
      "CREATE TABLE walk_points (walk_id INTEGER NOT NULL, t INTEGER NOT NULL, lat REAL NOT NULL, " +
        "lon REAL NOT NULL, accuracy REAL, PRIMARY KEY (walk_id, t))"
    )
  }

  private fun createUntimedAndLog(db: SQLiteDatabase) {
    // Steps known to lie between from_ms and to_ms, at times not known.
    db.execSQL(
      "CREATE TABLE untimed (from_ms INTEGER NOT NULL, to_ms INTEGER NOT NULL, steps INTEGER NOT NULL, reason TEXT NOT NULL)"
    )
    db.execSQL("CREATE INDEX untimed_to ON untimed (to_ms)")
    db.execSQL("CREATE TABLE log (t INTEGER NOT NULL, kind TEXT NOT NULL, detail TEXT NOT NULL)")
    db.execSQL("CREATE TABLE text_state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)")
  }

  fun getState(key: String, fallback: Long): Long {
    readableDatabase.rawQuery("SELECT value FROM state WHERE key = ?", arrayOf(key)).use {
      return if (it.moveToFirst()) it.getLong(0) else fallback
    }
  }

  fun setState(key: String, value: Long) {
    writableDatabase.insertWithOnConflict("state", null, stateValues(key, value), SQLiteDatabase.CONFLICT_REPLACE)
  }

  private fun stateValues(key: String, value: Long) = ContentValues().apply {
    put("key", key)
    put("value", value)
  }

  /** The counter state, or null before the first reading. */
  fun counterState(): StepAttribution.State? {
    val reading = getState(LAST_READING, -1)
    if (reading < 0) return null
    return StepAttribution.State(
      reading = reading,
      eventAt = getState(LAST_EVENT_AT, 0),
      bootCount = getState(BOOT_COUNT, StepAttribution.UNKNOWN_BOOT),
    )
  }

  /** Saves one reading's outcome and the new counter state together, so a kill in between can't lose or double steps. */
  fun saveAttribution(result: StepAttribution.Result) {
    val db = writableDatabase
    db.beginTransaction()
    try {
      // Two statements rather than an UPSERT: Android 9 ships SQLite 3.22, which predates it.
      for ((minute, steps) in result.placed) {
        db.execSQL("INSERT OR IGNORE INTO buckets (minute, steps) VALUES (?, 0)", arrayOf<Any>(minute))
        db.execSQL("UPDATE buckets SET steps = steps + ? WHERE minute = ?", arrayOf<Any>(steps, minute))
      }
      result.untimed?.let {
        db.insert("untimed", null, ContentValues().apply {
          put("from_ms", it.fromMs)
          put("to_ms", it.toMs)
          put("steps", it.steps)
          put("reason", it.reason)
        })
      }
      val next = result.next
      for ((key, value) in listOf(LAST_READING to next.reading, LAST_EVENT_AT to next.eventAt, BOOT_COUNT to next.bootCount)) {
        db.insertWithOnConflict("state", null, stateValues(key, value), SQLiteDatabase.CONFLICT_REPLACE)
      }
      db.setTransactionSuccessful()
    } finally {
      db.endTransaction()
    }
  }

  /**
   * Minute buckets that overlap [startMs, endMs), as (start epoch ms, steps).
   * The minute in progress is included, so the app and the notification agree.
   */
  fun buckets(startMs: Long, endMs: Long): List<Pair<Long, Long>> {
    val result = mutableListOf<Pair<Long, Long>>()
    readableDatabase.rawQuery(
      "SELECT minute, steps FROM buckets WHERE minute >= ? AND minute < ? ORDER BY minute",
      minuteRange(startMs, endMs)
    ).use {
      while (it.moveToNext()) result.add(it.getLong(0) * 60_000 to it.getLong(1))
    }
    return result
  }

  fun sum(startMs: Long, endMs: Long): Long {
    readableDatabase.rawQuery(
      "SELECT COALESCE(SUM(steps), 0) FROM buckets WHERE minute >= ? AND minute < ?",
      minuteRange(startMs, endMs)
    ).use {
      return if (it.moveToFirst()) it.getLong(0) else 0
    }
  }

  private fun minuteRange(startMs: Long, endMs: Long) =
    arrayOf(Math.floorDiv(startMs, 60_000L).toString(), Math.floorDiv(endMs + 59_999, 60_000L).toString())

  /** Untimed stretches that overlap [startMs, endMs), oldest first. */
  fun untimed(startMs: Long, endMs: Long): List<Map<String, Any>> {
    val result = mutableListOf<Map<String, Any>>()
    readableDatabase.rawQuery(
      "SELECT from_ms, to_ms, steps, reason FROM untimed WHERE to_ms > ? AND from_ms < ? ORDER BY from_ms",
      arrayOf(startMs.toString(), endMs.toString())
    ).use {
      while (it.moveToNext()) {
        result.add(
          mapOf(
            "from" to it.getLong(0).toDouble(),
            "to" to it.getLong(1).toDouble(),
            "steps" to it.getLong(2).toDouble(),
            "reason" to it.getString(3)
          )
        )
      }
    }
    return result
  }

  /** Keeps the last few hundred entries: enough for the Step check screen, small enough never to matter. */
  fun log(kind: String, detail: String) {
    val db = writableDatabase
    db.insert("log", null, ContentValues().apply {
      put("t", System.currentTimeMillis())
      put("kind", kind)
      put("detail", detail)
    })
    db.execSQL("DELETE FROM log WHERE rowid <= (SELECT MAX(rowid) FROM log) - 300")
  }

  /** Newest first. */
  fun logEntries(limit: Int): List<Map<String, Any>> {
    val result = mutableListOf<Map<String, Any>>()
    readableDatabase.rawQuery("SELECT t, kind, detail FROM log ORDER BY rowid DESC LIMIT ?", arrayOf(limit.toString())).use {
      while (it.moveToNext()) {
        result.add(mapOf("t" to it.getLong(0).toDouble(), "kind" to it.getString(1), "detail" to it.getString(2)))
      }
    }
    return result
  }

  /**
   * Android's Auto Backup can restore this database onto a reinstall or a new
   * phone. Its counter state then describes another install's sensor, and the
   * first reading would turn into thousands of phantom steps; and Google's
   * recorder keeps nothing for a new install. A token in the no-backup folder
   * tells the two apart (it isn't backed up), and for databases from before
   * the token existed, state older than this install can only be restored.
   * Either way the counter starts again from a fresh baseline.
   */
  fun checkInstall() {
    val file = File(context.noBackupFilesDir, "step_counter_install")
    val token = runCatching { file.readText() }.getOrNull()
    val stored = getStringState(INSTALL)
    if (token != null && token == stored) return
    val installedAt = runCatching { context.packageManager.getPackageInfo(context.packageName, 0).firstInstallTime }.getOrDefault(0L)
    val lastEventAt = getState(LAST_EVENT_AT, 0)
    val restored = stored != null || (lastEventAt in 1 until installedAt)
    val fresh = token ?: UUID.randomUUID().toString().also { runCatching { file.writeText(it) } }
    val db = writableDatabase
    db.beginTransaction()
    try {
      if (restored) {
        db.execSQL(
          "DELETE FROM state WHERE key IN (?, ?, ?, ?)",
          arrayOf<Any>(LAST_READING, LAST_EVENT_AT, BOOT_COUNT, RECORDER_SINCE)
        )
      }
      db.execSQL("DELETE FROM text_state WHERE key = ?", arrayOf<Any>(INSTALL))
      db.execSQL("INSERT INTO text_state (key, value) VALUES (?, ?)", arrayOf<Any>(INSTALL, fresh))
      db.setTransactionSuccessful()
    } finally {
      db.endTransaction()
    }
    if (restored) log("counter", "restored from a backup: counting starts afresh")
  }

  private fun getStringState(key: String): String? {
    readableDatabase.rawQuery("SELECT value FROM text_state WHERE key = ?", arrayOf(key)).use {
      return if (it.moveToFirst()) it.getString(0) else null
    }
  }

  fun addWalkPoint(walkId: Long, t: Long, lat: Double, lon: Double, accuracy: Float?) {
    val values = ContentValues().apply {
      put("walk_id", walkId)
      put("t", t)
      put("lat", lat)
      put("lon", lon)
      if (accuracy != null) put("accuracy", accuracy) else putNull("accuracy")
    }
    writableDatabase.insertWithOnConflict("walk_points", null, values, SQLiteDatabase.CONFLICT_IGNORE)
  }

  /** Fixes recorded after `afterT`, oldest first. */
  fun walkPoints(walkId: Long, afterT: Long): List<Map<String, Any?>> {
    val result = mutableListOf<Map<String, Any?>>()
    readableDatabase.rawQuery(
      "SELECT t, lat, lon, accuracy FROM walk_points WHERE walk_id = ? AND t > ? ORDER BY t",
      arrayOf(walkId.toString(), afterT.toString())
    ).use {
      while (it.moveToNext()) {
        result.add(
          mapOf(
            "t" to it.getLong(0).toDouble(),
            "lat" to it.getDouble(1),
            "lon" to it.getDouble(2),
            "acc" to if (it.isNull(3)) null else it.getDouble(3)
          )
        )
      }
    }
    return result
  }

  fun clearWalk(walkId: Long) {
    writableDatabase.execSQL("DELETE FROM walk_points WHERE walk_id = ?", arrayOf<Any>(walkId))
  }

  fun clear() {
    val db = writableDatabase
    db.execSQL("DELETE FROM buckets")
    db.execSQL("DELETE FROM untimed")
    db.execSQL("DELETE FROM log")
    // Keeps the install token: the data is gone, but this is still the same install.
    db.execSQL("DELETE FROM state")
    db.execSQL("DELETE FROM walk_points")
  }

  companion object {
    const val LAST_READING = "lastReading"
    const val LAST_EVENT_AT = "lastEventAt"
    const val BOOT_COUNT = "bootCount"
    /** Last time (epoch ms) the counter was seen alive and listening. */
    const val LAST_ALIVE_AT = "lastAliveAt"
    const val ENABLED = "enabled"
    /** Start time (epoch ms) of the walk being recorded or not yet saved by the app; 0 when none. */
    const val WALK_ID = "walkId"
    /** When Google's step recorder first started recording for this app (epoch ms); 0 when not in use. */
    const val RECORDER_SINCE = "recorderSince"
    private const val INSTALL = "install"

    @Volatile private var instance: StepStore? = null

    /** The one store; the first open in a process checks for a restored backup before anything reads it. */
    fun get(context: Context): StepStore =
      instance ?: synchronized(this) {
        instance ?: StepStore(context).also {
          runCatching { it.checkInstall() }
          instance = it
        }
      }
  }
}
