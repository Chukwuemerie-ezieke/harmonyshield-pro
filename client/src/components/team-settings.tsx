import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth, type Role } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KeyRound, Loader2, UserPlus, Users } from "lucide-react";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  dpo: "Data Protection Officer",
  teacher: "Teacher",
  staff: "Staff",
};

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function TeamSettings() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const isAdmin = hasRole("admin");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "staff" as Role, department: "", password: "" });
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const { data: members, isLoading } = useQuery<TeamMember[]>({ queryKey: ["/api/users"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/users", { ...form, department: form.department || null });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setCreated({ email: form.email, password: form.password });
      setForm({ name: "", email: "", role: "staff", department: "", password: "" });
    },
    onError: (err: Error) => toast({ title: "Could not add user", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Pick<TeamMember, "role" | "isActive">> }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User updated" });
    },
    onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const openDialog = () => {
    setCreated(null);
    setForm((f) => ({ ...f, password: generatePassword() }));
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="w-4 h-4" /> Team
        </CardTitle>
        {isAdmin && !user?.isDemo && (
          <Button size="sm" variant="outline" onClick={openDialog} data-testid="button-add-user">
            <UserPlus className="w-4 h-4 mr-2" /> Add user
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {members?.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-2 p-2 rounded-md border" data-testid={`team-member-${m.id}`}>
            <div className="flex-1 min-w-[180px]">
              <p className="text-sm font-medium">
                {m.name} {m.id === user?.id && <span className="text-xs text-muted-foreground">(you)</span>}
              </p>
              <p className="text-xs text-muted-foreground break-all">{m.email}</p>
            </div>
            {!m.isActive && <Badge variant="outline" className="text-[10px]">Deactivated</Badge>}
            {isAdmin && m.id !== user?.id && !user?.isDemo ? (
              <>
                <Select value={m.role} onValueChange={(role) => updateMutation.mutate({ id: m.id, data: { role: role as Role } })}>
                  <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => updateMutation.mutate({ id: m.id, data: { isActive: !m.isActive } })}
                >
                  {m.isActive ? "Deactivate" : "Reactivate"}
                </Button>
              </>
            ) : (
              <Badge variant="outline" className="text-[10px]">{ROLE_LABELS[m.role] ?? m.role}</Badge>
            )}
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{created ? "User added" : "Add a team member"}</DialogTitle>
          </DialogHeader>
          {created ? (
            <div className="space-y-3 text-sm">
              <p>Share these sign-in details securely (e.g. in person or by phone). They can change the password under Settings → Security.</p>
              <div className="rounded-md border p-3 font-mono text-xs space-y-1 break-all">
                <div>Email: {created.email}</div>
                <div>Temporary password: {created.password}</div>
              </div>
              <DialogFooter>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
            >
              <div>
                <Label className="text-xs">Full name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Role</Label>
                  <Select value={form.role} onValueChange={(role) => setForm({ ...form, role: role as Role })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Department (optional)</Label>
                  <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Temporary password</Label>
                <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={10} className="font-mono" />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Add user
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function SecuritySettings() {
  const { user, updateToken } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/change-password", { currentPassword, newPassword });
      return (await res.json()) as { token: string };
    },
    onSuccess: ({ token }) => {
      updateToken(token);
      setCurrent("");
      setNew("");
      setConfirm("");
      toast({ title: "Password changed", description: "Other sessions have been signed out." });
    },
    onError: (err: Error) => toast({ title: "Could not change password", description: err.message, variant: "destructive" }),
  });

  if (user?.isDemo) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <KeyRound className="w-4 h-4" /> Security
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (newPassword !== confirm) {
              toast({ title: "Passwords don't match", variant: "destructive" });
              return;
            }
            mutation.mutate();
          }}
        >
          <div>
            <Label className="text-xs">Current password</Label>
            <Input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div>
            <Label className="text-xs">New password (10+ characters)</Label>
            <Input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNew(e.target.value)} required minLength={10} />
          </div>
          <div>
            <Label className="text-xs">Confirm new password</Label>
            <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={10} />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Change password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
