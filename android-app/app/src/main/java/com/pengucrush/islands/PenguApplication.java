package com.pengucrush.islands;
import android.app.Application;
public final class PenguApplication extends Application {
    @Override public void onCreate() {
        super.onCreate();
        NotificationHub.createChannels(this);
        NotificationHub.reconcileCloud(this);
    }
}
