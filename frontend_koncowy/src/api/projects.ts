import { mockProjects } from "@/mocks/projects";
import { fakeDelay } from "./client";
import type { Project } from "@/types";

export async function getProjects(): Promise<Project[]> {
  return fakeDelay(mockProjects);
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  return fakeDelay(mockProjects.find((p) => p.id === id));
}
