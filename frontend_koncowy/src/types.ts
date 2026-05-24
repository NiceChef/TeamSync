/** Domain types for TeamSync. Swap mock services for HTTP clients without changing these contracts. */

export type UserRole = "admin" | "member" | "viewer";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee: User;
  priority: TaskPriority;
  status: TaskStatus;
  /** Termin (ISO 8601). */
  dueDate: string;
  /** Powiązany projekt (np. filtrowanie po stronie API). */
  projectId?: string;
}

export type ProjectStatus = "active" | "archived" | "draft";

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  /** Postęp w %. */
  progressPercent: number;
  createdAt: string;
  members: User[];
}

export interface DashboardStats {
  projectCount: number;
  activeTaskCount: number;
  upcomingEventCount: number;
  teamMemberCount: number;
}

export type CalendarEventType = "meeting" | "deadline" | "reminder";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  type: CalendarEventType;
  projectId?: string;
  attendees: User[];
}
