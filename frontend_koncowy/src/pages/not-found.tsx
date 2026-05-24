import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-6xl font-bold tracking-tighter">404</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        This page doesn't exist.
      </p>
      <Button className="mt-6" render={<Link to="/" />}>
        Back to Dashboard
      </Button>
    </div>
  );
}
