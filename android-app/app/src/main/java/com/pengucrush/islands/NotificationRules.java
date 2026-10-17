package com.pengucrush.islands;

import java.time.ZonedDateTime;
import java.util.Set;

/** Pure scheduling and routing rules, shared by reminders and cloud messages. */
public final class NotificationRules {
    private static final Set<String> ROUTES = new java.util.HashSet<>(java.util.Arrays.asList("home", "journey", "journal", "friends", "backpack", "leaderboard"));
    public static String route(String route) { return ROUTES.contains(route == null ? "" : route) ? route : "home"; }
    public static boolean validId(String id) { return id != null && id.matches("[A-Za-z0-9_-]{1,64}"); }
    public static boolean cloudCategory(String value) { return "events".equals(value) || "news".equals(value); }
    public static ZonedDateTime afterQuietHours(ZonedDateTime at) {
        if (at.getHour() >= 22) return at.plusDays(1).withHour(9).withMinute(0).withSecond(0).withNano(0);
        if (at.getHour() < 9) return at.withHour(9).withMinute(0).withSecond(0).withNano(0);
        return at;
    }
    public static ZonedDateTime nextDaily(ZonedDateTime now) {
        return now.plusDays(1).withHour(9).withMinute(0).withSecond(0).withNano(0);
    }
    public static long deliveryTime(long now, long last, int todayCount, ZonedDateTime local) {
        long spacing = last > 0 ? Math.max(now, last + 4 * 60 * 60 * 1000L) : now;
        ZonedDateTime at = ZonedDateTime.ofInstant(java.time.Instant.ofEpochMilli(spacing), local.getZone());
        if (todayCount >= 2) at = nextDaily(local);
        return afterQuietHours(at).toInstant().toEpochMilli();
    }
}
