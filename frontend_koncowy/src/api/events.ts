import { mockEvents } from "@/mocks/events";
import { fakeDelay } from "./client";
import type { CalendarEvent } from "@/types";

export async function getEvents(): Promise<CalendarEvent[]> {
  return fakeDelay(mockEvents);
}

export type UpdateEventPayload = Pick<CalendarEvent, "id"> &
  Partial<Pick<CalendarEvent, "start" | "end" | "title" | "description" | "type">>;

export async function updateEvent(payload: UpdateEventPayload): Promise<CalendarEvent> {
  const idx = mockEvents.findIndex((e) => e.id === payload.id);
  if (idx === -1) throw new Error(`Event ${payload.id} not found`);

  const updated = { ...mockEvents[idx]!, ...payload };
  mockEvents[idx] = updated;
  return fakeDelay(updated);
}
