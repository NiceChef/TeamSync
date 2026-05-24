import { CalendarDays, FolderKanban, CheckSquare, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useRecentTasks } from "@/hooks/use-recent-tasks";
import { useUpcomingEvents } from "@/hooks/use-upcoming-events";
import { userFullName } from "@/lib/user";
import { formatDateTimeShort } from "@/lib/date";

function StatCard({
  label,
  value,
  icon: Icon,
  isLoading,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      {isLoading ? (
        <Skeleton className="mt-2 h-9 w-16" />
      ) : (
        <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      )}
    </div>
  );
}

function RecentTasksSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EventsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg border p-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentTasks, isLoading: tasksLoading } = useRecentTasks();
  const { data: upcomingEvents, isLoading: eventsLoading } = useUpcomingEvents();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back to TeamSync</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Projects"
          value={stats?.projectCount ?? 0}
          icon={FolderKanban}
          isLoading={statsLoading}
        />
        <StatCard
          label="Active Tasks"
          value={stats?.activeTaskCount ?? 0}
          icon={CheckSquare}
          isLoading={statsLoading}
        />
        <StatCard
          label="Upcoming Events"
          value={stats?.upcomingEventCount ?? 0}
          icon={CalendarDays}
          isLoading={statsLoading}
        />
        <StatCard
          label="Team Members"
          value={stats?.teamMemberCount ?? 0}
          icon={Users}
          isLoading={statsLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Recent Tasks</h2>
          {tasksLoading ? (
            <RecentTasksSkeleton />
          ) : (
            <div className="space-y-3">
              {recentTasks?.map((task) => (
                <div key={task.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{userFullName(task.assignee)}</p>
                  </div>
                  <Badge
                    variant={
                      task.priority === "urgent"
                        ? "destructive"
                        : task.priority === "high"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {task.priority}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Upcoming Events</h2>
          {eventsLoading ? (
            <EventsSkeleton />
          ) : (
            <div className="space-y-3">
              {upcomingEvents?.slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTimeShort(event.start)}
                    </p>
                  </div>
                  <Badge variant="outline">{event.type}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
