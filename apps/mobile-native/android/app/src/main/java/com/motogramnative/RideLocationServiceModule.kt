package com.motogramnative

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import androidx.core.content.ContextCompat

class RideLocationServiceModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "RideLocationService"

  @ReactMethod
  fun start() {
    val ctx = reactApplicationContext
    val intent = Intent(ctx, RideLocationService::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      ContextCompat.startForegroundService(ctx, intent)
    } else {
      ctx.startService(intent)
    }
  }

  @ReactMethod
  fun stop() {
    val ctx = reactApplicationContext
    val intent = Intent(ctx, RideLocationService::class.java)
    ctx.stopService(intent)
  }
}

