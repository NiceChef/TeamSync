import { Link } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  registerClientSchema,
  registerEmployeeSchema,
  type RegisterClientFormValues,
  type RegisterEmployeeFormValues,
} from "@/lib/validations/auth-schemas";

const SUBMIT_DELAY_MS = 900;

function EmployeeRegisterForm() {
  const form = useForm<RegisterEmployeeFormValues>({
    resolver: zodResolver(registerEmployeeSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: RegisterEmployeeFormValues) {
    await new Promise((resolve) => setTimeout(resolve, SUBMIT_DELAY_MS));
    console.log("[TeamSync] Register (employee):", { role: "employee", ...values });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4 pt-2"
      >
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Imię</FormLabel>
              <FormControl>
                <Input autoComplete="given-name" placeholder="Jan" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nazwisko</FormLabel>
              <FormControl>
                <Input
                  autoComplete="family-name"
                  placeholder="Kowalski"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail (firmowy)</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="jan.kowalski@firma.pl"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hasło</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Rejestracja…" : "Utwórz konto"}
        </Button>
      </form>
    </Form>
  );
}

function ClientRegisterForm() {
  const form = useForm<RegisterClientFormValues>({
    resolver: zodResolver(registerClientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      companyName: "",
      password: "",
    },
  });

  async function onSubmit(values: RegisterClientFormValues) {
    await new Promise((resolve) => setTimeout(resolve, SUBMIT_DELAY_MS));
    console.log("[TeamSync] Register (client):", { role: "client", ...values });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4 pt-2"
      >
        <FormField
          control={form.control}
          name="firstName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Imię</FormLabel>
              <FormControl>
                <Input autoComplete="given-name" placeholder="Anna" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="lastName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nazwisko</FormLabel>
              <FormControl>
                <Input
                  autoComplete="family-name"
                  placeholder="Nowak"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="anna@example.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="companyName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nazwa firmy</FormLabel>
              <FormControl>
                <Input
                  autoComplete="organization"
                  placeholder="Acme Sp. z o.o."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hasło</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Rejestracja…" : "Utwórz konto"}
        </Button>
      </form>
    </Form>
  );
}

export function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 md:p-8">
      <div className="mb-8 text-center">
        <Link
          to="/"
          className="text-2xl font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
        >
          TeamSync
        </Link>
      </div>

      <Card className="w-full max-w-md shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Rejestracja</CardTitle>
          <CardDescription>
            Wybierz typ konta i uzupełnij dane, aby dołączyć do TeamSync.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="employee" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="employee">Pracownik</TabsTrigger>
              <TabsTrigger value="client">Klient</TabsTrigger>
            </TabsList>

            <TabsContent value="employee" className="outline-none">
              <EmployeeRegisterForm />
            </TabsContent>

            <TabsContent value="client" className="outline-none">
              <ClientRegisterForm />
            </TabsContent>
          </Tabs>
        </CardContent>

        <CardFooter className="flex justify-center border-t">
          <p className="text-muted-foreground text-sm">
            Masz już konto?{" "}
            <Link
              to="/login"
              className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
            >
              Zaloguj się
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
