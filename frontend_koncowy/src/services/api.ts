/**
 * Warstwa dostępu do danych dashboardu.
 * Obecnie mock + opóźnienie; podmiana na `fetch` / axios bez zmiany sygnatur.
 */
import { fakeDelay } from "@/api/client";
import type { CalendarEvent, DashboardStats, Task } from "@/types";
import {
  mockDashboardStats,
  mockRecentTasks,
  mockUpcomingEvents,
} from "@/mockData";

export async function getDashboardStats(): Promise<DashboardStats> {
  return fakeDelay(mockDashboardStats);
}

export async function getRecentTasks(): Promise<Task[]> {
  return fakeDelay(mockRecentTasks);
}

export async function getUpcomingEvents(): Promise<CalendarEvent[]> {
  return fakeDelay(mockUpcomingEvents);
}
