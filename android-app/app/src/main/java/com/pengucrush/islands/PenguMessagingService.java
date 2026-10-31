package com.pengucrush.islands;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
public final class PenguMessagingService extends FirebaseMessagingService {
    @Override public void onMessageReceived(RemoteMessage message){NotificationHub.receiveCloud(this,message.getData());}
    @Override public void onNewToken(String token){
        // The web app sends this token to the PenguCrush API only while a cloud category is on,
        // so the operator can target segments. Turning both categories off deletes it.
        NotificationHub.prefs(this).edit().putString("token",token).apply();
        if(NotificationHub.wantsCloud(this))NotificationHub.reconcileCloud(this);
    }
}
