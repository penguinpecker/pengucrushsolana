package com.pengucrush.islands;
import static org.junit.Assert.*;
import org.junit.Test;
import java.time.ZonedDateTime;
public class NotificationRulesTest {
    @Test public void nightMovesToNineNextDay(){assertEquals("2026-09-25T09:00+05:30[Asia/Kolkata]",NotificationRules.afterQuietHours(ZonedDateTime.parse("2026-09-24T22:15+05:30[Asia/Kolkata]")).toString());}
    @Test public void earlyMorningMovesToNineSameDay(){assertEquals(9,NotificationRules.afterQuietHours(ZonedDateTime.parse("2026-09-24T08:59Z")).getHour());}
    @Test public void daylightIsNotDelayed(){ZonedDateTime now=ZonedDateTime.parse("2026-09-24T09:00Z");assertEquals(now,NotificationRules.afterQuietHours(now));}
    @Test public void dailyFollowsLocalCalendarAcrossDst(){ZonedDateTime at=NotificationRules.nextDaily(ZonedDateTime.parse("2026-03-07T20:00-05:00[America/New_York]"));assertEquals("2026-03-08T09:00-04:00[America/New_York]",at.toString());}
    @Test public void twoMessagesDeferUntilNextDay(){ZonedDateTime now=ZonedDateTime.parse("2026-09-24T12:00Z");assertEquals(NotificationRules.nextDaily(now).toInstant().toEpochMilli(),NotificationRules.deliveryTime(now.toInstant().toEpochMilli(),0,2,now));}
    @Test public void spacingCanRollIntoQuietHours(){ZonedDateTime now=ZonedDateTime.parse("2026-09-24T20:00Z");long millis=now.toInstant().toEpochMilli();assertEquals(NotificationRules.nextDaily(now).toInstant().toEpochMilli(),NotificationRules.deliveryTime(millis,millis-3600000,1,now));}
    @Test public void fourHoursMinimum(){ZonedDateTime now=ZonedDateTime.parse("2026-09-24T12:00Z");long millis=now.toInstant().toEpochMilli();assertEquals(millis+3*3600000,NotificationRules.deliveryTime(millis,millis-3600000,1,now));}
    @Test public void routesCannotOpenExternalContent(){assertEquals("home",NotificationRules.route("https://example.com"));assertEquals("home",NotificationRules.route("play/100"));assertEquals("journal",NotificationRules.route("journal"));assertEquals("home",NotificationRules.route(null));}
    @Test public void validateIdsAndCategories(){assertFalse(NotificationRules.validId("../../bad"));assertFalse(NotificationRules.validId(""));assertTrue(NotificationRules.validId("summer-2026_1"));assertTrue(NotificationRules.cloudCategory("events"));assertFalse(NotificationRules.cloudCategory("rewards"));}
}
