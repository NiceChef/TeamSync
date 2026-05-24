import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/services/api";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: getDashboardStats,
  });
}
