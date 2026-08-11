import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import NebulaBackground from "@/components/NebulaBackground";

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        // Preserve the FULL consent URL so auth returns the user here.
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      if (data && "redirect_url" in data) { window.location.href = data.redirect_url; return; }
      setDetails(data);
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId)
      : await supabase.auth.oauth.denyAuthorization(authorizationId);
    if (error) { setBusy(false); return setError(error.message); }
    const target = data?.redirect_url;
    if (!target) { setBusy(false); return setError("No redirect returned by the authorization server."); }
    window.location.href = target;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <NebulaBackground />
      <Card className="w-full max-w-md crystal-card relative z-10">
        <CardHeader className="space-y-1">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Authorize app
            </CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Review this connection request before continuing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-destructive">Could not load this authorization request: {error}</p>
          ) : !details ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Connect {details.client?.name ?? "an app"} to your account
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This lets {details.client?.name ?? "the client"} use GTA as you — browsing and managing
                  skill listings and activities on your behalf.
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  disabled={busy}
                  onClick={() => decide(true)}
                  className="flex-1 plasma-button text-primary-foreground"
                >
                  {busy ? "Working…" : "Approve"}
                </Button>
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => decide(false)}
                  className="flex-1 border-border"
                >
                  Deny
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
