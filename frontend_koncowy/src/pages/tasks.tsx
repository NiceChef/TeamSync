import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTasks } from "@/hooks/use-tasks";
import { userFullName, userInitials } from "@/lib/user";
import { formatDateTimeShort } from "@/lib/date";

const statusLabel = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
} as const;

const priorityVariant = {
  low: "outline",
  medium: "secondary",
  high: "default",
  urgent: "destructive",
} as const;

export function TasksPage() {
  const { data: tasks, isLoading } = useTasks();

  const columns = ["todo", "in_progress", "done"] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
        <p className="text-muted-foreground">Track and organize your work</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading tasks...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {columns.map((status) => {
            const columnTasks = tasks?.filter((t) => t.status === status) ?? [];
            return (
              <div key={status} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{statusLabel[status]}</h3>
                  <span className="text-xs text-muted-foreground">{columnTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {columnTasks.map((task) => (
                    <div key={task.id} className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{task.title}</p>
                        <Badge variant={priorityVariant[task.priority]} className="shrink-0 text-[10px]">
                          {task.priority}
                        </Badge>
                      </div>
                      {task.dueDate && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Due{" "}
                          {formatDateTimeShort(task.dueDate)}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={task.assignee.avatar} alt={userFullName(task.assignee)} />
                          <AvatarFallback className="text-[8px]">{userInitials(task.assignee)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">{userFullName(task.assignee)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
