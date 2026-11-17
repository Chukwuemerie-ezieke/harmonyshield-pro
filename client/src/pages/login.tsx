import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Shield, Eye, EyeOff, Loader2, PlayCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PublicConfig {
  demoAvailable: boolean;
  appUrl: string;
  demoUrl: string;
}

export default function Login() {
  const { login, loginDemo, isLoading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const { data: config } = useQuery<PublicConfig>({ queryKey: ["/api/config"], staleTime: Infinity });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      toast({ title: "Welcome back", description: "Successfully signed in." });
    } catch (err: any) {
      setError(err.message || "Sign in failed");
    }
  };

  const handleDemo = async () => {
    setError("");
    try {
      await loginDemo();
      toast({ title: "Welcome to the demo", description: "This is a read-only sample school." });
    } catch (err: any) {
      setError(err.message || "Demo unavailable");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(217,45%,12%)] via-[hsl(217,45%,18%)] to-[hsl(217,50%,8%)] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href={BRAND.siteUrl} className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </a>
          <h1 className="text-2xl font-semibold text-white tracking-tight">{BRAND.name}</h1>
          <p className="text-sm text-gray-400 mt-1">{BRAND.tagline}</p>
        </div>

        {config?.demoAvailable && (
          <Card className="border-primary/30 bg-primary/10 backdrop-blur-sm mb-4">
            <CardContent className="p-5 text-center space-y-3">
              <p className="text-sm text-gray-200">
                Explore a sample school with live threat feeds, NDPR checklist, incidents and training.
              </p>
              <Button onClick={handleDemo} disabled={isLoading} className="w-full" data-testid="button-demo">
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
                Explore the demo
              </Button>
              <p className="text-[11px] text-gray-400">Read-only · no sign-up needed</p>
            </CardContent>
          </Card>
        )}

        <Card className="border-white/10 bg-white/5 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <h2 className="text-lg font-medium text-white text-center">Sign in to your school</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">Email address</Label>
                <Input
                  id="email"
                  data-testid="input-email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@school.edu.ng"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    data-testid="input-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 pr-10"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    data-testid="toggle-password-visibility"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-md" role="alert" data-testid="text-error">
                  {error}
                </p>
              )}

              <Button type="submit" data-testid="button-submit-login" className="w-full font-medium" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>

            <div className="mt-5 text-center text-xs text-gray-400 space-y-2">
              <p>
                Accounts are created by your school administrator.
              </p>
              <p>
                New school?{" "}
                <a className="text-primary hover:underline" href={`mailto:${BRAND.contactEmail}?subject=HavonaShield%20for%20our%20school`}>
                  Request access
                </a>
                {!config?.demoAvailable && config?.demoUrl && (
                  <>
                    {" · "}
                    <a className="text-primary hover:underline" href={config.demoUrl}>Try the demo</a>
                  </>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-500 mt-6">
          {BRAND.name} by {BRAND.company}
        </p>
      </div>
    </div>
  );
}
