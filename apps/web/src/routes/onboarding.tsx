import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

import { Permissions, Roles } from "@rbac";
import { getRootSession } from "@/features/user/lib/get-root-session";
import {
  getOnboardingPlans,
  type OnboardingPlanOption,
} from "@/features/onboarding/lib/get-onboarding-plans";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: async ({ context }) => {
    const [session, plans] = await Promise.all([
      Promise.resolve(context.session ?? getRootSession()),
      getOnboardingPlans(),
    ]);

    if (!session) {
      throw redirect({
        to: "/login",
      });
    }

    const skipsOnboarding =
      session.permissions.includes(Permissions.AdminAccess) ||
      session.primaryRoleSlug === Roles.PlatformOwner ||
      session.primaryRoleSlug === Roles.PlatformAdmin;

    if (skipsOnboarding || session.user.onboardingComplete === true) {
      throw redirect({
        to: "/dashboard",
      });
    }

    return { plans };
  },
  component: OnboardingPage,
});

const stepOneSchema = z.object({
  useCase: z.string().min(1, "Please select how you plan to use this app"),
  companyName: z.string(),
});

const stepTwoSchema = z.object({
  plan: z.literal("free", {
    error: "Free plan is the only available option for now.",
  }),
});

function getFormErrorMessage(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function OnboardingPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { plans } = Route.useRouteContext();
  const [step, setStep] = useState(1);
  const [useCase, setUseCase] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [stepError, setStepError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = () => {
    try {
      if (step === 1) {
        stepOneSchema.parse({ useCase, companyName });
      }

      if (step === 2) {
        stepTwoSchema.parse({ plan: selectedPlan });
      }

      setStepError(null);
      setStep((currentStep) => Math.min(currentStep + 1, 3));
    } catch (error: any) {
      const message = getFormErrorMessage(
        error,
        "Please complete this step to continue.",
      );
      toast.error(message);
      setStepError(null);
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    setStepError(null);

    try {
      stepOneSchema.parse({ useCase, companyName });
      stepTwoSchema.parse({ plan: selectedPlan });

      await authClient.updateUser({
        onboardingComplete: true,
      } as any);

      await router.invalidate();
      await navigate({ to: "/dashboard", replace: true });
      await router.invalidate();

      // Force a hard refresh so server session context rehydrates from fresh auth state.
      window.location.assign("/dashboard");
    } catch (error: any) {
      const message = getFormErrorMessage(error, "Something went wrong.");
      toast.error(message);
      setStepError(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressValue = (step / 3) * 100;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome!</CardTitle>
          <CardDescription>
            Step {step} of 3. Let&apos;s finish your setup.
          </CardDescription>
          <Progress value={progressValue} className="mt-2" />
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>How do you plan to use this app?</Label>
                <Select value={useCase} onValueChange={(value) => setUseCase(value ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a use case" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal Use</SelectItem>
                    <SelectItem value="work">Work / Business</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Company or Organization (Optional)</Label>
                <Input
                  placeholder="Acme Inc."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <StepTwoPlanSelection
              plans={plans}
              selectedPlan={selectedPlan}
              onSelectPlan={setSelectedPlan}
            />
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <h3 className="font-medium">You&apos;re all set.</h3>
              <p className="text-sm text-muted-foreground">
                We&apos;ll start you on the Free plan. Continue to your dashboard.
              </p>
            </div>
          ) : null}

          {stepError ? (
            <p className="text-[0.8rem] font-medium text-destructive mt-4">{stepError}</p>
          ) : null}
        </CardContent>
        <CardFooter>
          {step === 1 ? (
            <Button className="w-full" onClick={handleNext}>
              Continue
            </Button>
          ) : null}

          {step === 2 ? (
            <div className="w-full flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setStep(1);
                  setStepError(null);
                }}
              >
                Go Back
              </Button>
              <Button className="flex-1" onClick={handleNext}>
                Continue
              </Button>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="w-full flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setStep(2);
                  setStepError(null);
                }}
                disabled={isSubmitting}
              >
                Go Back
              </Button>
              <Button className="flex-1" onClick={handleComplete} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue to Dashboard
              </Button>
            </div>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  );
}

function StepTwoPlanSelection({
  plans,
  selectedPlan,
  onSelectPlan,
}: {
  plans: OnboardingPlanOption[];
  selectedPlan: string;
  onSelectPlan: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Label>Select a subscription plan</Label>
      {plans.map((plan) => {
        const isSelected = selectedPlan === plan.slug;
        return (
          <button
            key={plan.slug}
            type="button"
            onClick={() => {
              if (plan.selectable) {
                onSelectPlan(plan.slug);
              }
            }}
            className={[
              "w-full rounded-md border p-3 text-left transition",
              isSelected ? "border-primary bg-primary/5" : "border-border",
              plan.selectable ? "cursor-pointer" : "cursor-not-allowed opacity-60",
            ].join(" ")}
          >
            <p className="font-medium">{plan.name}</p>
            <p className="text-xs text-muted-foreground">
              {plan.selectable ? "Available now" : "Coming soon"}
            </p>
          </button>
        );
      })}
    </div>
  );
}
