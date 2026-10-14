import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Shield, Eye, EyeOff, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { login, isLoading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      toast({ title: "Welcome back", description: "Successfully logged in." });
    } catch (err: any) {
      const msg = err.message?.includes("401") ? "Invalid email or password" : err.message || "Login failed";
      setError(msg);
    }
  };

  const fillDemo = () => {
    setEmail("admin@fgcenugu.edu.ng");
    setPassword("demo123");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(217,45%,12%)] via-[hsl(217,45%,18%)] to-[hsl(217,50%,8%)] p-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">HarmonyShield Pro</h1>
          <p className="text-sm text-gray-400 mt-1">EdTech Cybersecurity Suite for Nigerian Schools</p>
        </div>

        <Card className="border-white/10 bg-white/5 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <h2 className="text-lg font-medium text-white text-center">Sign In</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">Email Address</Label>
                <Input
                  id="email"
                  data-testid="input-email"
                  type="email"
                  placeholder="admin@school.edu.ng"
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
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 pr-10"
                    required
                  />
                  <button
                    type="button"
                    data-testid="toggle-password-visibility"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-md" data-testid="text-error">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                data-testid="button-submit-login"
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Demo credentials */}
            <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-xs text-gray-400 mb-1">Demo Credentials</p>
              <button
                type="button"
                data-testid="button-fill-demo"
                className="text-xs text-primary hover:underline cursor-pointer"
                onClick={fillDemo}
              >
                admin@fgcenugu.edu.ng / demo123
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-500 mt-6">
          Powered by Harmony Digital Consults
        </p>
      </div>
    </div>
  );
}
