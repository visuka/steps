package expo.modules.stepcounter

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * Per-minute step counts plus the counter state needed to turn the sensor's
 * "steps since boot" into deltas. Lives in its own small database so the
 * service can write without the JS runtime.
 */
class StepStore(context: Context) :
  SQLiteOpenHelper(context.applicationContext, "step_counter.db", null, 1) {

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL("CREATE TABLE buckets (minute INTEGER PRIMARY KEY NOT NULL, steps INTEGER NOT NULL)")
    db.execSQL("CREATE TABLE state (key TEXT PRIMARY KEY NOT NULL, value INTEGER NOT NULL)")
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

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

  fun clear() {
    writableDatabase.execSQL("DELETE FROM buckets")
    writableDatabase.execSQL("DELETE FROM state")
  }

  companion object {
    const val LAST_READING = "lastReading"
    const val LAST_EVENT_AT = "lastEventAt"
    const val ENABLED = "enabled"

    @Volatile private var instance: StepStore? = null

    fun get(context: Context): StepStore =
      instance ?: synchronized(this) { instance ?: StepStore(context).also { instance = it } }
  }
}
