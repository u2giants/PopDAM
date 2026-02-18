import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mail, Trash2, UserPlus, Check } from "lucide-react";

interface Invitation {
  id: string;
  email: string;
  accepted_at: string | null;
  created_at: string;
}

export default function InviteManager() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isAdmin) loadInvitations();
  }, [isAdmin]);

  if (!isAdmin) return null;

  async function loadInvitations() {
    const { data } = await (supabase as any)
      .from("invitations")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setInvitations(data as Invitation[]);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !user) return;
    setSending(true);

    try {
      const { error } = await (supabase as any).from("invitations").insert({
        email: email.toLowerCase().trim(),
        invited_by: user.id,
      });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Already invited", description: "This email has already been invited.", variant: "destructive" });
        } else {
          throw error;
        }
      } else {
        // Send invitation email via Brevo
        const inviterName = user.user_metadata?.full_name || user.email || "Your team";

        const { error: emailErr } = await supabase.functions.invoke("send-invite-email", {
          body: { email: email.toLowerCase().trim(), inviterName, appUrl: window.location.origin },
        });

        if (emailErr) {
          console.error("Email send failed:", emailErr);
          toast({
            title: "Invited (email failed)",
            description: `${email} was added but the email could not be sent.`,
            variant: "destructive",
          });
        } else {
          toast({ title: "Invitation sent!", description: `${email} will receive an email with a link to join.` });
        }

        setEmail("");
        loadInvitations();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    const { error } = await (supabase as any).from("invitations").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      loadInvitations();
    }
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="h-4 w-4 text-primary" /> Invite Team Members
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleInvite} className="flex gap-2">
          <Input
            type="email"
            placeholder="colleague@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1"
          />
          <Button type="submit" disabled={sending} className="gap-1">
            <Mail className="h-4 w-4" />
            {sending ? "..." : "Invite"}
          </Button>
        </form>

        {invitations.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Invitations</p>
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-foreground">{inv.email}</span>
                  {inv.accepted_at ? (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Check className="h-3 w-3" /> Joined
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">Pending</Badge>
                  )}
                </div>
                {!inv.accepted_at && (
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(inv.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
