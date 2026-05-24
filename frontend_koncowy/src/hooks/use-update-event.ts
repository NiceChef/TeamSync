import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateEvent, type UpdateEventPayload } from "@/api/events";
import type { CalendarEvent } from "@/types";

export function useUpdateEvent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: updateEvent,

    onMutate: async (payload: UpdateEventPayload) => {
      await qc.cancelQueries({ queryKey: ["events"] });

      const previous = qc.getQueryData<CalendarEvent[]>(["events"]);

      qc.setQueryData<CalendarEvent[]>(["events"], (old) =>
        old?.map((ev) => (ev.id === payload.id ? { ...ev, ...payload } : ev)),
      );

      return { previous };
    },

    onError: (_err, _payload, context) => {
      if (context?.previous) {
        qc.setQueryData(["events"], context.previous);
      }
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
