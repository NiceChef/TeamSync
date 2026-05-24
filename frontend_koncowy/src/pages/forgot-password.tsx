import { Link } from "react-router-dom";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Placeholder until reset flow is implemented (link target from login). */
export function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 md:p-8">
      <Card className="w-full max-w-md shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Reset hasła</CardTitle>
          <CardDescription>
            Ta funkcja będzie dostępna wkrótce. Tymczasem skontaktuj się z
            administratorem organizacji.
          </CardDescription>
        </CardHeader>
        <CardContent />
        <CardFooter className="flex justify-center border-t">
          <Link
            to="/login"
            className={cn(buttonVariants({ variant: "outline", size: "default" }))}
          >
            Wróć do logowania
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
