package com.pengucrush.islands;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.*;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.JSONObject;
import java.time.ZonedDateTime;
import java.util.Map;
import java.util.concurrent.TimeUnit;

public final class NotificationHub {
    static volatile boolean foreground;
    static final String TAG = "pengu-notifications";
    static final String[] OPTIONS = {"daily", "rewards", "resume", "events", "news"};
    static final Object CLOUD_LOCK = new Object();
    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("pengu-notifications", Context.MODE_PRIVATE); }
    static boolean enabled(Context c, String key) { return prefs(c).getBoolean(key, false); }
    static boolean allowed(Context c) { return NotificationManagerCompat.from(c).areNotificationsEnabled(); }
    static boolean configured() { return !BuildConfig.FIREBASE_APP_ID.isEmpty() && !BuildConfig.FIREBASE_API_KEY.isEmpty(); }
    static boolean wantsCloud(Context c) { return allowed(c) && (enabled(c, "events") || enabled(c, "news")); }
    static String topic(String category) { return "pengucrush_" + category + "_v1"; }

    static void createChannels(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        String[][] channels = {{"daily","Daily quests"},{"rewards","Ready rewards"},{"resume","Continue your expedition"},{"events","Expedition announcements"},{"news","Game news"},{"test","Notification preview"}};
        for (String[] row : channels) {
            NotificationChannel ch = new NotificationChannel(row[0], row[1], NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("PenguCrush · " + row[1]);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
    }
    static FirebaseApp firebase(Context c) {
        if (!configured()) return null;
        if (!FirebaseApp.getApps(c).isEmpty()) return FirebaseApp.getInstance();
        FirebaseOptions options = new FirebaseOptions.Builder().setApplicationId(BuildConfig.FIREBASE_APP_ID)
            .setApiKey(BuildConfig.FIREBASE_API_KEY).setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
            .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID).build();
        return FirebaseApp.initializeApp(c, options);
    }
    static JSONObject status(Context c) {
        JSONObject result = new JSONObject();
        try {
            for (String key : OPTIONS) result.put(key, enabled(c,key));
            result.put("native", true).put("permission", allowed(c)).put("configured", configured())
                .put("asked", prefs(c).getBoolean("asked",false))
                .put("deletionPending", prefs(c).getBoolean("deletePending",false))
                .put("cloudStatus", prefs(c).getString("cloudStatus",configured()?"off":"unconfigured"))
                .put("token", prefs(c).getString("token",""));
        } catch (Exception ignored) { }
        return result;
    }
    static void updatePreferences(Context c, String json) {
        try {
            JSONObject input = new JSONObject(json);
            SharedPreferences.Editor edit = prefs(c).edit();
            for (String key : OPTIONS) if (input.has(key)) {
                boolean value = input.optBoolean(key,false);
                if (NotificationRules.cloudCategory(key) && value && (!configured() || !allowed(c) || prefs(c).getBoolean("deletePending",false))) continue;
                edit.putBoolean(key, value);
                if (!value) c.getSystemService(NotificationManager.class).cancel(key.hashCode());
            }
            edit.apply();
            scheduleLocal(c);
            reconcileCloud(c);
        } catch (Exception ignored) { }
    }
    static void reconcileCloud(Context c) {
        if (!configured()) return;
        SharedPreferences p = prefs(c);
        if (!wantsCloud(c) && p.getBoolean("cloudEver",false)) {
            p.edit().putBoolean("events",false).putBoolean("news",false).putBoolean("deletePending",true).putString("cloudStatus","removing").apply();
            if (!FirebaseApp.getApps(c).isEmpty()) FirebaseMessaging.getInstance().setAutoInitEnabled(false);
            WorkManager.getInstance(c).cancelAllWorkByTag("pengu-cloud-message");
        }
        if (!wantsCloud(c) && !p.getBoolean("deletePending",false)) return;
        if (wantsCloud(c)) {
            firebase(c);
            p.edit().putBoolean("cloudEver",true).putString("cloudStatus","connecting").apply();
        }
        OneTimeWorkRequest work = new OneTimeWorkRequest.Builder(CloudSyncWorker.class)
            .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL,30,TimeUnit.SECONDS).build();
        WorkManager.getInstance(c).enqueueUniqueWork("pengu-cloud-sync", ExistingWorkPolicy.REPLACE, work);
    }
    static void updateGame(Context c, String json) {
        // Only a small local reminder summary crosses the bridge. It never goes to Firebase.
        try {
            JSONObject input = new JSONObject(json);
            int level = Math.max(0,Math.min(100,input.optInt("level",0)));
            JSONObject safe = new JSONObject().put("level",level)
                .put("rewardKey",input.optString("rewardKey","").substring(0,Math.min(2000,input.optString("rewardKey","").length())))
                .put("rewardRoute",NotificationRules.route(input.optString("rewardRoute","journal")))
                .put("rewardExpiry",input.optLong("rewardExpiry",0));
            prefs(c).edit().putString("game",safe.toString()).apply();
        } catch(Exception ignored) { }
    }
    static JSONObject game(Context c) {
        try {return new JSONObject(prefs(c).getString("game","{}"));} catch(Exception e) {return new JSONObject();}
    }
    static void onForeground(Context c) {
        foreground = true;
        prefs(c).edit().putLong("generation",System.currentTimeMillis()).apply();
        for (String kind : new String[]{"daily","rewards","resume"}) {
            WorkManager.getInstance(c).cancelUniqueWork("pengu-local-"+kind);
            c.getSystemService(NotificationManager.class).cancel(kind.hashCode());
        }
        reconcileCloud(c);
    }
    static void onBackground(Context c) { foreground = false; scheduleLocal(c); }
    static void scheduleLocal(Context c) {
        prefs(c).edit().putLong("generation",System.currentTimeMillis()).apply();
        for(String kind : new String[]{"daily","rewards","resume"}) WorkManager.getInstance(c).cancelUniqueWork("pengu-local-"+kind);
        if (foreground || !allowed(c)) return;
        long now = System.currentTimeMillis(); JSONObject g = game(c); ZonedDateTime local = ZonedDateTime.now();
        if (enabled(c,"daily")) localWork(c,"daily","New quests, fresh footprints","Three new daily quests are ready in your journal.","journal",NotificationRules.nextDaily(local).toInstant().toEpochMilli(),now+48*3600000L,local.toLocalDate().plusDays(1).toString());
        String key = g.optString("rewardKey","");
        if (enabled(c,"rewards") && !key.isEmpty()) localWork(c,"rewards","A little treasure is waiting","You earned a reward. Open the expedition to collect it.",g.optString("rewardRoute","journal"),now+3600000L,g.optLong("rewardExpiry",now+24*3600000L),key);
        if (enabled(c,"resume") && g.optInt("level",0)>0) localWork(c,"resume","Your crew saved your spot","Level "+g.optInt("level")+" is ready whenever you are.","home",now+24*3600000L,now+72*3600000L,"level-"+g.optInt("level"));
    }
    private static void localWork(Context c,String kind,String title,String body,String route,long at,long expires,String key) {
        Data data = new Data.Builder().putString("kind",kind).putString("id",kind+"-"+Integer.toHexString(key.hashCode()))
            .putString("title",title).putString("body",body).putString("route",route).putString("eventKey",key).putLong("expires",expires).putLong("generation",prefs(c).getLong("generation",0)).build();
        enqueue(c,"pengu-local-"+kind,data,at,false);
    }
    static void enqueue(Context c,String name,Data data,long at,boolean cloud) {
        OneTimeWorkRequest.Builder builder = new OneTimeWorkRequest.Builder(NotificationWorker.class).setInputData(data)
            .setInitialDelay(Math.max(0,at-System.currentTimeMillis()),TimeUnit.MILLISECONDS).addTag(TAG);
        if (cloud) builder.addTag("pengu-cloud-message");
        WorkManager.getInstance(c).enqueueUniqueWork(name, ExistingWorkPolicy.REPLACE,builder.build());
    }
    static boolean receiveCloud(Context c, Map<String,String> input) {
        String id=input.get("id"),kind=input.get("category"),title=input.get("title"),body=input.get("body");
        if (!NotificationRules.validId(id) || !NotificationRules.cloudCategory(kind) || !wantsCloud(c) || !enabled(c,kind)
            || title==null || title.trim().isEmpty() || title.length()>70 || body==null || body.trim().isEmpty() || body.length()>240) return false;
        long now=System.currentTimeMillis(), expires;
        try {expires=Long.parseLong(input.getOrDefault("expiresAt","0"));} catch(Exception e) {return false;}
        if (expires<=now || expires>now+7*24*3600000L || prefs(c).contains("sent-"+id)) return false;
        Data data=new Data.Builder().putString("kind",kind).putString("id",id).putString("title",title).putString("body",body)
            .putString("route",NotificationRules.route(input.get("route"))).putLong("expires",expires).putBoolean("cloud",true).build();
        enqueue(c,"pengu-push-"+id,data,now,true);
        return true;
    }
    static boolean post(Context c,String kind,String title,String body,String route) {
        if (!allowed(c)) return false;
        NotificationManager nm=c.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(kind).getImportance()==NotificationManager.IMPORTANCE_NONE) return false;
        Intent intent=new Intent(c,MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra("pengu_route",NotificationRules.route(route));
        PendingIntent tap=PendingIntent.getActivity(c,kind.hashCode(),intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder message=new NotificationCompat.Builder(c,kind).setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title).setContentText(body).setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(tap).setAutoCancel(true).setColor(0xff397d72).setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setCategory(NotificationCompat.CATEGORY_EVENT).setOnlyAlertOnce(true).setTimeoutAfter(24*3600000L);
        try { nm.notify(kind.hashCode(),message.build());return true; } catch(SecurityException e) {return false;}
    }
    static void reset(Context c) {
        boolean cleanup=prefs(c).getBoolean("cloudEver",false)||prefs(c).getBoolean("deletePending",false);
        SharedPreferences.Editor edit=prefs(c).edit().clear();
        if(cleanup)edit.putBoolean("cloudEver",true).putBoolean("deletePending",true).putString("cloudStatus","removing");
        for(String key:OPTIONS)edit.putBoolean(key,false);
        edit.remove("game").apply();
        WorkManager.getInstance(c).cancelAllWorkByTag(TAG);
        c.getSystemService(NotificationManager.class).cancelAll();
        reconcileCloud(c);
    }
}
