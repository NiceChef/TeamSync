import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useProjects } from "@/hooks/use-projects";
import { userFullName, userInitials } from "@/lib/user";
import { formatDateTimeShort } from "@/lib/date";

const statusColor = {
  active: "default",
  archived: "secondary",
  draft: "outline",
} as const;

export function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="text-muted-foreground">Manage and track your team projects</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading projects...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project) => (
            <div key={project.id} className="rounded-xl border bg-card p-6 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold">{project.name}</h3>
                <Badge variant={statusColor[project.status]}>{project.status}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                {project.description}
              </p>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{project.progressPercent}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${project.progressPercent}%` }}
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {project.members.map((member) => (
                    <Tooltip key={member.id}>
                      <TooltipTrigger>
                        <Avatar className="h-7 w-7 border-2 border-background">
                          <AvatarImage src={member.avatar} alt={userFullName(member)} />
                          <AvatarFallback className="text-xs">{userInitials(member)}</AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>{userFullName(member)}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDateTimeShort(project.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
