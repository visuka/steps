package expo.modules.stepcounter

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * Per-minute step counts plus the counter state needed to turn the sensor's
 * "steps since boot" into deltas, and the GPS fixes of a walk being recorded.
 * Lives in its own small database so the services can write without the JS
 * runtime.
 */
class StepStore(context: Context) :
  SQLiteOpenHelper(context.applicationContext, "step_counter.db", null, 2) {

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL("CREATE TABLE buckets (minute INTEGER PRIMARY KEY NOT NULL, steps INTEGER NOT NULL)")
    db.execSQL("CREATE TABLE state (key TEXT PRIMARY KEY NOT NULL, value INTEGER NOT NULL)")
    createWalkPoints(db)
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    if (oldVersion < 2) createWalkPoints(db)
  }

  private fun createWalkPoints(db: SQLiteDatabase) {
    db.execSQL(
      "CREATE TABLE walk_points (walk_id INTEGER NOT NULL, t INTEGER NOT NULL, lat REAL NOT NULL, " +
        "lon REAL NOT NULL, accuracy REAL, PRIMARY KEY (walk_id, t))"
    )
  }

  fun getState(key: String, fallback: Long): Long {
    readableDatabase.rawQuery("SELECT value FROM state WHERE key = ?", arrayOf(key)).use {
      return if (it.moveToFirst()) it.getLong(0) else fallback
    }
  }

  fun setState(key: String, value: Long) {
    val values = ContentValues().apply {
      put("key", key)
      put("value", value)
    }
    writableDatabase.insertWithOnConflict("state", null, values, SQLiteDatabase.CONFLICT_REPLACE)
  }

  // Two statements rather than an UPSERT: Android 9 ships SQLite 3.22, which predates it.
  fun addSteps(minute: Long, steps: Long) {
    val db = writableDatabase
    db.beginTransaction()
    try {
      db.execSQL("INSERT OR IGNORE INTO buckets (minute, steps) VALUES (?, 0)", arrayOf<Any>(minute))
      db.execSQL("UPDATE buckets SET steps = steps + ? WHERE minute = ?", arrayOf<Any>(steps, minute))
      db.setTransactionSuccessful()
    } finally {
      db.endTransaction()
    }
  }

  /** Minute buckets with steps, as (start epoch ms, steps). */
  fun buckets(startMs: Long, endMs: Long): List<Pair<Long, Long>> {
    val result = mutableListOf<Pair<Long, Long>>()
    readableDatabase.rawQuery(
      "SELECT minute, steps FROM buckets WHERE minute >= ? AND minute < ? ORDER BY minute",
      arrayOf((startMs / 60_000).toString(), (endMs / 60_000).toString())
    ).use {
      while (it.moveToNext()) result.add(it.getLong(0) * 60_000 to it.getLong(1))
    }
    return result
  }

  fun sum(startMs: Long, endMs: Long): Long {
    readableDatabase.rawQuery(
      "SELECT COALESCE(SUM(steps), 0) FROM buckets WHERE minute >= ? AND minute < ?",
      arrayOf((startMs / 60_000).toString(), (endMs / 60_000).toString())
    ).use {
      return if (it.moveToFirst()) it.getLong(0) else 0
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
    writableDatabase.execSQL("DELETE FROM buckets")
    writableDatabase.execSQL("DELETE FROM state")
    writableDatabase.execSQL("DELETE FROM walk_points")
  }

  companion object {
    const val LAST_READING = "lastReading"
    const val LAST_EVENT_AT = "lastEventAt"
    const val ENABLED = "enabled"
    /** Start time (epoch ms) of the walk being recorded or not yet saved by the app; 0 when none. */
    const val WALK_ID = "walkId"

    @Volatile private var instance: StepStore? = null

    fun get(context: Context): StepStore =
      instance ?: synchronized(this) { instance ?: StepStore(context).also { instance = it } }
  }
}
