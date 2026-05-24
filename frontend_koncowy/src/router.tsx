import { createBrowserRouter, Outlet } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PublicRoute } from "@/components/auth/PublicRoute";
import { MainLayout } from "@/components/layout/main-layout";
import { CalendarPage } from "@/pages/calendar";
import { DashboardPage } from "@/pages/dashboard";
import { ForgotPasswordPage } from "@/pages/forgot-password";
import { LoginPage } from "@/pages/login";
import { NotFoundPage } from "@/pages/not-found";
import { ProjectsPage } from "@/pages/projects";
import { RegisterPage } from "@/pages/register";
import { TasksPage } from "@/pages/tasks";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Outlet />,
    children: [
      {
        element: <PublicRoute />,
        children: [
          { path: "login", element: <LoginPage /> },
          { path: "register", element: <RegisterPage /> },
          { path: "forgot-password", element: <ForgotPasswordPage /> },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <MainLayout />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: "calendar", element: <CalendarPage /> },
              { path: "projects", element: <ProjectsPage /> },
              { path: "tasks", element: <TasksPage /> },
              { path: "*", element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
