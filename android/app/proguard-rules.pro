# SmartHoldem Wallet — R8 keep rules for release builds.
# Capacitor discovers plugins by class name and invokes @PluginMethod handlers
# reflectively; keep every plugin class + its annotated members intact.
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public <methods>;
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
}
-keep class cx.sth.wallet.** { *; }

# Plugin packages (JS bridge names must survive)
-keep class ee.forgr.** { *; }
-keep class com.aparajita.** { *; }
-keep class com.capacitorjs.** { *; }
-keep class io.ionic.** { *; }
-keep class com.outsystems.** { *; }

# WebView JavaScript interface used by the in-app dApp browser bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Biometric / ML Kit
-keep class androidx.biometric.** { *; }
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.android.gms.**
-dontwarn com.google.mlkit.**
-dontwarn com.google.gson.annotations.SerializedName
