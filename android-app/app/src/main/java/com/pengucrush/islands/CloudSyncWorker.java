package com.pengucrush.islands;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.*;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.installations.FirebaseInstallations;
import java.util.concurrent.TimeUnit;

public final class CloudSyncWorker extends Worker {
    public CloudSyncWorker(Context c,WorkerParameters p){super(c,p);}
    @NonNull @Override public Result doWork(){
        Context c=getApplicationContext();
        synchronized(NotificationHub.CLOUD_LOCK){
            if(!NotificationHub.configured())return Result.success();
            boolean deleting=NotificationHub.prefs(c).getBoolean("deletePending",false);
            if(!deleting&&!NotificationHub.wantsCloud(c))return Result.success();
            try{
                NotificationHub.firebase(c); FirebaseMessaging messaging=FirebaseMessaging.getInstance();
                messaging.setDeliveryMetricsExportToBigQuery(false);
                if(deleting){
                    messaging.setAutoInitEnabled(false);
                    for(String kind:new String[]{"events","news"}) Tasks.await(messaging.unsubscribeFromTopic(NotificationHub.topic(kind)),30,TimeUnit.SECONDS);
                    Tasks.await(messaging.deleteToken(),30,TimeUnit.SECONDS);
                    Tasks.await(FirebaseInstallations.getInstance().delete(),30,TimeUnit.SECONDS);
                    NotificationHub.prefs(c).edit().putBoolean("deletePending",false).putBoolean("cloudEver",false).putString("cloudStatus","off").apply();
                }else{
                    // Register only after both the in-app opt-in and Android permission.
                    messaging.setAutoInitEnabled(true);
                    Tasks.await(messaging.getToken(),30,TimeUnit.SECONDS);
                    for(String kind:new String[]{"events","news"}){
                        if(!NotificationHub.wantsCloud(c))break;
                        Tasks.await(NotificationHub.enabled(c,kind)?messaging.subscribeToTopic(NotificationHub.topic(kind)):messaging.unsubscribeFromTopic(NotificationHub.topic(kind)),30,TimeUnit.SECONDS);
                    }
                    if(NotificationHub.wantsCloud(c))NotificationHub.prefs(c).edit().putString("cloudStatus","connected").apply();
                }
                return Result.success();
            }catch(Exception e){
                NotificationHub.prefs(c).edit().putString("cloudStatus",deleting?"removing":"waiting").apply();
                return Result.retry();
            }
        }
    }
}
