import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gem, Mail, Lock, LogIn } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const result = await login(email, password);

    setIsLoading(false);
    if (result.success) {
      navigate("/", { replace: true });
    } else {
      setError(result.error ?? "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Theme toggle - top right */}
      <div className="fixed top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 20%, hsl(214 100% 58% / 0.08), transparent 50%)",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div
          className={cn(
            "rounded-2xl border border-border bg-card p-8 shadow-xl",
            "animate-fade-in"
          )}
          style={{ boxShadow: "0 0 40px hsl(214 100% 58% / 0.06)" }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center mb-4">
              <Gem className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground font-space">LeadGen Pro</h1>
            <p className="text-sm text-muted-foreground mt-1">HK Exports · Sign in to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-secondary/50 border-border focus:ring-primary/30"
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 bg-secondary/50 border-border focus:ring-primary/30"
                  autoComplete="current-password"
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_hsl(214_100%_58%/0.2)] hover:shadow-[0_0_30px_hsl(214_100%_58%/0.35)] disabled:opacity-60"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              Sign in
            </Button>
          </form>

          <p className="text-[11px] text-muted-foreground/60 text-center mt-6">
            Secure login. Credentials will integrate with API when ready.
          </p>
        </div>
      </div>
    </div>
  );
}
