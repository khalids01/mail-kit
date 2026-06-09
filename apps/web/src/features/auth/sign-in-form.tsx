import { Link } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import z from "zod";

import { client } from "@/lib/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInForm() {
  const magicLinkForm = useForm({
    defaultValues: {
      email: "",
    },
    onSubmit: async ({ value }) => {
      const { error } = await client.auth["magic-link"].login.post({
        email: value.email,
      });

      if (error) {
        // @ts-ignore
        const message = error.value?.message || "Failed to send magic link";
        toast.error(message);
        return;
      }

      toast.success("Magic link sent! Check your email.");
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
      }),
    },
  });

  return (
    <div className="mx-auto w-full mt-10 max-w-md p-6">
      <h1 className="mb-6 text-center text-3xl font-bold">Welcome Back</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          magicLinkForm.handleSubmit();
        }}
        className="space-y-4"
      >
        <div>
          <magicLinkForm.Field name="email">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="magic-email">Email</Label>
                <Input
                  id="magic-email"
                  name={field.name}
                  type="email"
                  placeholder="you@example.com"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {field.state.meta.errors.map((error) => (
                  <p key={error?.message} className="text-red-500 text-sm">
                    {error?.message}
                  </p>
                ))}
              </div>
            )}
          </magicLinkForm.Field>
        </div>

        <magicLinkForm.Subscribe>
          {(state) => (
            <Button
              type="submit"
              className="w-full"
              disabled={!state.canSubmit || state.isSubmitting}
            >
              {state.isSubmitting ? "Sending..." : "Send Magic Link"}
            </Button>
          )}
        </magicLinkForm.Subscribe>
      </form>
      <div className="mt-4 text-center">
        <Button
          asChild
          variant="link"
          className="text-indigo-600 hover:text-indigo-800"
        >
          <Link to="/signup">Need an account? Sign Up</Link>
        </Button>
      </div>
    </div>
  );
}
