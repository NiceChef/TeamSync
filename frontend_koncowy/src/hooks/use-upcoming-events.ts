import { useQuery } from "@tanstack/react-query";
import { getUpcomingEvents } from "@/services/api";

export function useUpcomingEvents() {
  return useQuery({
    queryKey: ["dashboard", "upcoming-events"],
    queryFn: getUpcomingEvents,
  });
}
