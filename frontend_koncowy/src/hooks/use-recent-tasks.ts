import { useQuery } from "@tanstack/react-query";
import { getRecentTasks } from "@/services/api";

export function useRecentTasks() {
  return useQuery({
    queryKey: ["dashboard", "recent-tasks"],
    queryFn: getRecentTasks,
  });
}
