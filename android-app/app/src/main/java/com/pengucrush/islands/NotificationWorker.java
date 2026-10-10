package com.pengucrush.islands;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.annotation.NonNull;
import androidx.work.*;
import org.json.JSONObject;
import java.time.ZonedDateTime;

public final class NotificationWorker extends Worker {
    private static final Object DELIVERY_LOCK=new Object();
    public NotificationWorker(Context c, WorkerParameters p) {super(c,p);}
    @NonNull @Override public Result doWork() {
        synchronized(DELIVERY_LOCK){return deliver();}
    }
    private Result deliver() {
        Context c=getApplicationContext(); Data d=getInputData();
        String kind=d.getString("kind"),id=d.getString("id"); long now=System.currentTimeMillis();
        if(kind==null||id==null||!NotificationHub.allowed(c)||!NotificationHub.enabled(c,kind)||d.getLong("expires",0)<=now)return Result.success();
        SharedPreferences p=NotificationHub.prefs(c); if(p.contains("sent-"+id))return Result.success();
        boolean cloud=d.getBoolean("cloud",false);
        if(cloud&&!NotificationHub.wantsCloud(c))return Result.success();
        if(!cloud){
            if(d.getLong("generation",0)!=p.getLong("generation",0))return Result.success();
            JSONObject game=NotificationHub.game(c);
            if("rewards".equals(kind)&&!game.optString("rewardKey","").equals(d.getString("eventKey")))return Result.success();
            if("resume".equals(kind)&&!("level-"+game.optInt("level",0)).equals(d.getString("eventKey")))return Result.success();
            if(NotificationHub.foreground)return Result.success();
        }
        ZonedDateTime local=ZonedDateTime.now();String day=local.toLocalDate().toString();
        int count=day.equals(p.getString("sentDay",""))?p.getInt("sentCount",0):0;
        long at=NotificationRules.deliveryTime(now,p.getLong("lastSent",0),count,local);
        if(cloud&&NotificationHub.foreground)at=Math.max(at,now+5*60000L);
        if(at>now+1000){
            if(at<d.getLong("expires",0))NotificationHub.enqueue(c,"pengu-deferred-"+id,d,at,cloud);
            return Result.success();
        }
        if(NotificationHub.post(c,kind,d.getString("title"),d.getString("body"),d.getString("route"))){
            SharedPreferences.Editor edit=p.edit().putLong("sent-"+id,now).putLong("lastSent",now).putString("sentDay",day).putInt("sentCount",count+1);
            for(String key:p.getAll().keySet())if(key.startsWith("sent-")&&p.getLong(key,0)<now-30L*24*3600000)edit.remove(key);
            edit.apply();
        }
        return Result.success();
    }
}
