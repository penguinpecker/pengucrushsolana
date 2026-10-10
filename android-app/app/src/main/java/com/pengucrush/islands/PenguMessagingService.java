package com.pengucrush.islands;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
public final class PenguMessagingService extends FirebaseMessagingService {
    @Override public void onMessageReceived(RemoteMessage message){NotificationHub.receiveCloud(this,message.getData());}
    @Override public void onNewToken(String token){
        // Tokens stay in the SDK. This app does not run a player-token database.
        if(NotificationHub.wantsCloud(this))NotificationHub.reconcileCloud(this);
    }
}
