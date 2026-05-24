import { useQuery } from "@tanstack/react-query";
import { getEvents } from "@/api/events";

export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: getEvents,
  });
}
