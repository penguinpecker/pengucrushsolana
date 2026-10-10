package com.pengucrush.islands;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.Manifest;
import android.provider.Settings;
import org.json.JSONObject;
import com.google.firebase.messaging.FirebaseMessaging;
import android.annotation.SuppressLint;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;

/** Bundled game host. Only the native, consent-gated messaging SDK uses the network. */
public final class MainActivity extends Activity {
    private static final String ORIGIN = "appassets.androidplatform.net";
    private static final String GAME = "https://" + ORIGIN + "/assets/www/index.html?native=1";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView web;
    private FrameLayout root;
    private View errorView;
    private boolean ready = false;
    private boolean failed = false;
    private long started;
    private String pendingRoute = "";

    @Override public void onCreate(Bundle savedState) {
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        super.onCreate(savedState);
        captureRoute(getIntent());
        started = SystemClock.uptimeMillis();
        splash.setKeepOnScreenCondition(() -> !ready && !failed && SystemClock.uptimeMillis() - started < 12000);
        splash.setOnExitAnimationListener(provider -> provider.getView().animate()
            .alpha(0f).setDuration(180).withEndAction(provider::remove).start());
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams layout = getWindow().getAttributes();
            layout.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(layout);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(255,242,207));
        setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            Insets safe = insets.getInsets(WindowInsetsCompat.Type.displayCutout());
            view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            return insets;
        });
        createWebView();
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(0, this::handleBack);
        handler.postDelayed(() -> { if (!ready && !failed) showError(); }, 12000);
        immersive();
    }

    private void createWebView() {
        if (web != null) { root.removeView(web); web.destroy(); }
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(255,242,207));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportZoom(false);
        settings.setTextZoom(100);
        settings.setMediaPlaybackRequiresUserGesture(true);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        web.addJavascriptInterface(new GameBridge(), "PenguNative");
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse response = loader.shouldInterceptRequest(request.getUrl());
                // No resource may silently fall through to a network dependency.
                return response != null ? response : new WebResourceResponse("text/plain", "UTF-8", 404, "Not found", null, new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                return !"https".equals(url.getScheme()) || !ORIGIN.equals(url.getHost());
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError();
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                showError();
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage message) {
                Log.println(message.messageLevel() == ConsoleMessage.MessageLevel.ERROR ? Log.ERROR : Log.INFO,
                    "PenguCrush", message.message() + " (" + message.lineNumber() + ")");
                return true;
            }
        });
        root.addView(web, 0, new FrameLayout.LayoutParams(-1,-1));
        web.loadUrl(GAME);
    }

    public final class GameBridge {
        @JavascriptInterface public String notificationStatus() { return NotificationHub.status(MainActivity.this).toString(); }
        @JavascriptInterface public String launchRoute() { String route=pendingRoute;pendingRoute="";return route; }
        @JavascriptInterface public void notificationPreferences(String json) {
            handler.post(() -> {NotificationHub.updatePreferences(MainActivity.this,json);notifyStatus();});
        }
        @JavascriptInterface public void notificationGameState(String json) { NotificationHub.updateGame(MainActivity.this,json); }
        @JavascriptInterface public void requestNotifications() {
            handler.post(() -> {
                NotificationHub.prefs(MainActivity.this).edit().putBoolean("asked",true).apply();
                if(Build.VERSION.SDK_INT>=33&&!NotificationHub.allowed(MainActivity.this))requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},41);
                else notifyStatus();
            });
        }
        @JavascriptInterface public void openNotificationSettings() {
            handler.post(() -> startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName())));
        }
        @JavascriptInterface public void previewNotification() {
            handler.post(() -> NotificationHub.post(MainActivity.this,"test","A little treasure is waiting","This is how reminders from your crew will look.","journal"));
        }
        @JavascriptInterface public void eraseGameData() { handler.post(() -> {NotificationHub.reset(MainActivity.this);notifyStatus();}); }
        @JavascriptInterface public void copyPushToken() {
            handler.post(() -> {
                if(!NotificationHub.configured()||!NotificationHub.wantsCloud(MainActivity.this))return;
                NotificationHub.firebase(MainActivity.this);
                FirebaseMessaging.getInstance().getToken().addOnSuccessListener(token -> {
                    getSystemService(ClipboardManager.class).setPrimaryClip(ClipData.newPlainText("PenguCrush test device",token));
                    emit("pengu:notification-message","Test device code copied. Share it only with your support team.");
                }).addOnFailureListener(error -> emit("pengu:notification-message","Could not get a device code. Check your connection."));
            });
        }
        @JavascriptInterface public void openExternal(String address) {
            handler.post(() -> {
                Uri uri=Uri.parse(address);
                if(!"https".equals(uri.getScheme())&&!"mailto".equals(uri.getScheme()))return;
                try {startActivity(new Intent(Intent.ACTION_VIEW,uri));} catch(Exception e){emit("pengu:notification-message","No app is available to open this link.");}
            });
        }
        @JavascriptInterface public void ready() {
            handler.post(() -> {
                ready = true;
                failed = false;
                if (errorView != null) { root.removeView(errorView); errorView = null; }
                immersive();
            });
        }
        @JavascriptInterface public void haptic() {
            handler.post(() -> {
                if (web != null) web.performHapticFeedback(Build.VERSION.SDK_INT >= 30
                    ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.KEYBOARD_TAP);
            });
        }
    }

    private void emit(String name,String value) {
        if(web!=null)web.evaluateJavascript("window.dispatchEvent(new CustomEvent("+JSONObject.quote(name)+",{detail:"+JSONObject.quote(value)+"}))",null);
    }
    private void notifyStatus(){emit("pengu:notifications",NotificationHub.status(this).toString());}
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){
        super.onRequestPermissionsResult(request,permissions,results);
        if(request==41){NotificationHub.reconcileCloud(this);notifyStatus();}
    }
    private void captureRoute(Intent intent){
        if(intent!=null&&intent.hasExtra("pengu_route")){
            pendingRoute=NotificationRules.route(intent.getStringExtra("pengu_route"));
            intent.removeExtra("pengu_route");
        }
    }
    @Override protected void onNewIntent(Intent intent){
        super.onNewIntent(intent);setIntent(intent);captureRoute(intent);
        if(ready&&!pendingRoute.isEmpty()){emit("pengu:route",pendingRoute);pendingRoute="";}
    }

    private void immersive() {
        WindowInsetsControllerCompat controls = WindowCompat.getInsetsController(getWindow(), root);
        controls.setAppearanceLightStatusBars(true);
        controls.setAppearanceLightNavigationBars(true);
        controls.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controls.hide(WindowInsetsCompat.Type.systemBars());
    }
    private void handleBack() {
        if (failed || web == null) { finish(); return; }
        web.evaluateJavascript("Boolean(window.__penguNativeBack && window.__penguNativeBack())", result -> {
            if (!"true".equals(result)) new AlertDialog.Builder(this)
                .setTitle("Leave the expedition?")
                .setMessage("Your progress is saved on this device.")
                .setNegativeButton("Keep playing", (dialog, which) -> immersive())
                .setPositiveButton("Exit game", (dialog, which) -> finish())
                .setOnCancelListener(dialog -> immersive()).show();
        });
    }
    // API 33+ uses the OnBackInvokedDispatcher registered in onCreate. This
    // override supplies Back support for Android 8–12 only.
    @SuppressLint("GestureBackNavigation")
    @SuppressWarnings("deprecation") @Override public void onBackPressed() { handleBack(); }
    @Override protected void onPause() {
        if (web != null) { web.evaluateJavascript("window.dispatchEvent(new Event('pengu:native-pause'))", null); web.onPause(); web.pauseTimers(); }
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        NotificationHub.onForeground(this);
        if (web != null) { web.resumeTimers(); web.onResume(); immersive(); notifyStatus(); }
    }
    @Override protected void onStop(){super.onStop();NotificationHub.onBackground(this);}
    private void showError() {
        failed = true;
        if (errorView != null || isFinishing()) return;
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setGravity(Gravity.CENTER);
        panel.setPadding(56,56,56,56);
        panel.setBackgroundColor(Color.rgb(255,242,207));
        TextView title = new TextView(this);
        title.setText("Let’s get you back in."); title.setTextColor(Color.rgb(23,45,62)); title.setTextSize(24);
        TextView message = new TextView(this);
        message.setText("Your expedition is saved. Reload the game to continue.");
        message.setGravity(Gravity.CENTER); message.setTextSize(16); message.setPadding(0,30,0,36);
        Button retry = new Button(this);
        retry.setText("Reload game");
        retry.setOnClickListener(v -> { root.removeView(panel); errorView = null; failed = false; ready = false; createWebView(); });
        panel.addView(title); panel.addView(message); panel.addView(retry);
        errorView = panel; root.addView(panel, new FrameLayout.LayoutParams(-1,-1));
    }
    @Override protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (web != null) { web.removeJavascriptInterface("PenguNative"); web.destroy(); }
        super.onDestroy();
    }
}
