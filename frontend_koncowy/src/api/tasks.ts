import { mockTasks } from "@/mocks/tasks";
import { fakeDelay } from "./client";
import type { Task } from "@/types";

export async function getTasks(): Promise<Task[]> {
  return fakeDelay(mockTasks);
}

export async function getTasksByProject(projectId: string): Promise<Task[]> {
  return fakeDelay(mockTasks.filter((t) => t.projectId === projectId));
}
