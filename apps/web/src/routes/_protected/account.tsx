import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useSession } from "@/providers/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_protected/account")({
  component: AccountPage,
});

function AccountPage() {
  const { session } = useSession();
  const [name, setName] = useState(session?.user?.name || "");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await authClient.updateUser({ name });
      toast.success("Profile updated successfully!");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update profile");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirm("Are you absolutely sure you want to delete your account? This action cannot be undone.")) {
      try {
        await authClient.deleteUser({
          fetchOptions: {
            onSuccess: () => {
              window.location.href = "/";
            }
          }
        });
      } catch (error: any) {
        toast.error("Failed to delete account");
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account profile, billing, and preferences.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Public Profile</CardTitle>
              <CardDescription>
                This is how others will see you on the site.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form id="profile-form" onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={session?.user?.email || ""}
                    disabled
                  />
                  <p className="text-[0.8rem] text-muted-foreground">
                    Your email address is managed by your sign-in provider.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
              </form>
            </CardContent>
            <CardFooter>
              <Button type="submit" form="profile-form" disabled={isUpdating}>
                {isUpdating ? "Saving..." : "Save changes"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Billing & Subscription</CardTitle>
              <CardDescription>
                Manage your subscription plans and billing information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-4 rounded-lg border bg-muted/30">
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Current Plan</p>
                  <h3 className="text-xl font-bold mt-1">
                    {session?.user.plan === "pro" ? "Pro Plan" : "Free Plan"}
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Status</p>
                  <p className={cn(
                    "mt-1 font-semibold",
                    session?.user.subscriptionStatus === "active" ? "text-green-600" : "text-amber-600"
                  )}>
                    {session?.user.subscriptionStatus?.toUpperCase() || "NO ACTIVE SUBSCRIPTION"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Your billing is handled securely through Polar. Click the button below to manage your subscription, download invoices, or update payment methods.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                variant="default"
                onClick={async () => {
                  try {
                    const result = await authClient.customer.portal();
                    if (result.data?.url) {
                      window.location.href = result.data.url;
                    } else {
                      toast.error("Could not open billing portal");
                    }
                  } catch (error) {
                    toast.error("Failed to open billing portal");
                  }
                }}
              >
                Open Billing Portal
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="danger" className="space-y-6">
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Permanently delete your account and all of your content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Once you delete your account, there is no going back. Please be certain.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="destructive" onClick={handleDeleteAccount}>
                Delete Account
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
