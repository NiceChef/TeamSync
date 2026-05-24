import { useQuery } from "@tanstack/react-query";
import { getTasks, getTasksByProject } from "@/api/tasks";

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: getTasks,
  });
}

export function useTasksByProject(projectId: string) {
  return useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => getTasksByProject(projectId),
    enabled: !!projectId,
  });
}
