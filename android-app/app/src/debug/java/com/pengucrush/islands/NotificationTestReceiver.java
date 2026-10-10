package com.pengucrush.islands;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.work.*;
import org.json.JSONObject;
import java.util.HashMap;
import java.util.Map;
/** ADB-only QA entry point. This class and receiver are absent from release builds. */
public final class NotificationTestReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c,Intent intent){
        String action=intent.getStringExtra("case");
        if("reset".equals(action)){NotificationHub.reset(c);setResultData("reset");return;}
        if("cloud".equals(action)){
            NotificationHub.prefs(c).edit().putBoolean("events",true).apply();
            Map<String,String> data=new HashMap<>();
            for(String key:new String[]{"id","title","body","category","route","expiresAt"})data.put(key,intent.getStringExtra(key));
            setResultData(NotificationHub.receiveCloud(c,data)?"accepted":"rejected");return;
        }
        if("reward".equals(action)){
            long now=System.currentTimeMillis();
            NotificationHub.prefs(c).edit().putBoolean("rewards",true).apply();
            NotificationHub.updateGame(c,"{\"level\":7,\"rewardKey\":\"qa-reward\",\"rewardRoute\":\"journal\",\"rewardExpiry\":"+(now+86400000)+"}");
            // Same worker input as the real earned-reward scheduler, due now for QA.
            Data d=new Data.Builder().putString("kind","rewards").putString("id","qa-reward")
                .putString("title","Your expedition reward is ready").putString("body","An earned reward is waiting in your journal.")
                .putString("route","journal").putString("eventKey","qa-reward").putLong("expires",now+86400000)
                .putLong("generation",NotificationHub.prefs(c).getLong("generation",0)).build();
            NotificationHub.enqueue(c,"qa-event-reward",d,now,false);setResultData("enqueued");return;
        }
        if("state".equals(action)){
            PendingResult pending=goAsync();
            new Thread(()->{try{
                JSONObject state=NotificationHub.status(c).put("game",NotificationHub.game(c)).put("foreground",NotificationHub.foreground);
                for(String kind:new String[]{"daily","rewards","resume"}){
                    java.util.List<WorkInfo> rows=WorkManager.getInstance(c).getWorkInfosForUniqueWork("pengu-local-"+kind).get();
                    state.put(kind+"Scheduled",rows.stream().anyMatch(w->w.getState()==WorkInfo.State.ENQUEUED));
                }
                pending.setResultData(state.toString());
            }catch(Exception e){pending.setResultData(e.getClass().getSimpleName());}finally{pending.finish();}}).start();
        }
    }
}
