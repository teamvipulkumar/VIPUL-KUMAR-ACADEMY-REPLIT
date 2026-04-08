import { useListNotifications, getListNotificationsQueryKey, useMarkNotificationRead, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck } from "lucide-react";

export default function NotificationsPage() {
  const { data: notifications, isLoading } = useListNotifications({ query: { queryKey: getListNotificationsQueryKey() } });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const queryClient = useQueryClient();

  const handleMarkRead = (id: number) => {
    markRead.mutate({ notificationId: id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
    });
  };

  const handleMarkAll = () => {
    markAll.mutate(undefined, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
    });
  };

  const typeColors: Record<string, string> = {
    success: "border-l-green-500",
    info: "border-l-blue-500",
    warning: "border-l-yellow-500",
    error: "border-l-red-500",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
            <p className="text-muted-foreground mt-1">{notifications?.filter(n => !n.isRead).length ?? 0} unread</p>
          </div>
          {notifications && notifications.some(n => !n.isRead) && (
            <Button variant="outline" size="sm" onClick={handleMarkAll}>
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark all read
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-card rounded-xl animate-pulse" />)}</div>
        ) : !notifications || notifications.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-16 text-center">
              <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No notifications</h2>
              <p className="text-muted-foreground">You're all caught up!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <div key={n.id} className={`p-4 rounded-xl bg-card border border-border border-l-4 ${typeColors[n.type] ?? "border-l-border"} ${!n.isRead ? "opacity-100" : "opacity-60"} transition-opacity`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                  {!n.isRead && (
                    <Button variant="ghost" size="sm" className="flex-shrink-0 text-xs" onClick={() => handleMarkRead(n.id)}>
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
