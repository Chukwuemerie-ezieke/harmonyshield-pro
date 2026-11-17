import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Building2, Link2, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { TeamSettings, SecuritySettings } from "@/components/team-settings";

export default function SettingsPage() {
  const { user, hasRole } = useAuth();
  const { toast } = useToast();
  const canSeeTeam = hasRole("admin", "dpo");
  const canEditSchool = hasRole("admin") && !user?.isDemo;
  const { data: feeds } = useQuery<FeedStatus>({ queryKey: ["/api/feeds/status"] });

  const { data: school, isLoading } = useQuery<any>({
    queryKey: ["/api/settings"],
  });

  // School form
  const [schoolName, setSchoolName] = useState("");
  const [address, setAddress] = useState("");
  const [state, setState] = useState("");
  const [schoolType, setSchoolType] = useState("secondary");
  const [studentCount, setStudentCount] = useState("");
  const [ndpcRegNumber, setNdpcRegNumber] = useState("");

  useEffect(() => {
    if (school) {
      setSchoolName(school.name || "");
      setAddress(school.address || "");
      setState(school.state || "");
      setSchoolType(school.type || "secondary");
      setStudentCount(school.studentCount?.toString() || "");
      setNdpcRegNumber(school.ndpcRegNumber || "");
    }
  }, [school]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", "/api/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved", description: "School profile has been updated." });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      name: schoolName,
      address,
      state,
      type: schoolType,
      studentCount: parseInt(studentCount) || 0,
      ndpcRegNumber: ndpcRegNumber || null,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold" data-testid="text-settings-title">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your school profile and preferences</p>
      </div>

      {/* User Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="w-4 h-4" /> User Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-semibold text-primary">
              {user?.name?.split(" ").map(n => n[0]).join("").substring(0, 2)}
            </div>
            <div>
              <p className="text-sm font-medium" data-testid="text-user-name">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              <Badge variant="outline" className="text-[10px] mt-1 capitalize">{user?.role}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* School Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Building2 className="w-4 h-4" /> School Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">School Name</Label>
              <Input
                data-testid="input-school-name"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">NDPC Registration Number</Label>
              <Input
                data-testid="input-ndpc-reg"
                value={ndpcRegNumber}
                onChange={(e) => setNdpcRegNumber(e.target.value)}
                placeholder="NDPC/SCH/YYYY/XXXX"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Address</Label>
            <Input
              data-testid="input-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">State</Label>
              <Input
                data-testid="input-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">School Type</Label>
              <Select value={schoolType} onValueChange={setSchoolType}>
                <SelectTrigger className="h-8 text-sm" data-testid="select-school-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="tertiary">Tertiary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Student Count</Label>
              <Input
                data-testid="input-student-count"
                type="number"
                value={studentCount}
                onChange={(e) => setStudentCount(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          {canEditSchool && <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            data-testid="button-save-school"
            size="sm"
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>}
        </CardContent>
      </Card>

      <SecuritySettings />

      {canSeeTeam && <TeamSettings />}

      {/* Integrations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Threat intelligence feeds
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 rounded-lg border flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Security news (RSS)</p>
              <p className="text-xs text-muted-foreground">{feeds?.rssFeeds.sources.join(", ")}</p>
            </div>
            <Badge variant="outline" className="text-[10px]">{feedLabel(feeds?.rssFeeds)}</Badge>
          </div>
          <div className="p-3 rounded-lg border flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">AlienVault OTX</p>
              <p className="text-xs text-muted-foreground">Threat intelligence pulses{feeds?.otxThreats.hasApiKey ? " (subscribed feed)" : " (public feed)"}</p>
            </div>
            <Badge variant="outline" className="text-[10px]">{feedLabel(feeds?.otxThreats)}</Badge>
          </div>
          <div className="p-3 rounded-lg border flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">AbuseIPDB</p>
              <p className="text-xs text-muted-foreground">IP reputation checks</p>
            </div>
            <Badge variant="outline" className="text-[10px]">{feeds?.abuseIPDB.hasApiKey ? "Connected" : "Not configured"}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Feeds refresh automatically every 15 minutes.</p>
        </CardContent>
      </Card>
    </div>
  );
}

interface FeedStatus {
  rssFeeds: { status: string; lastUpdate: string | null; sources: string[] };
  otxThreats: { status: string; lastUpdate: string | null; hasApiKey: boolean };
  abuseIPDB: { hasApiKey: boolean };
}

function feedLabel(f?: { status: string; lastUpdate: string | null }) {
  if (!f || f.status !== "active" || !f.lastUpdate) return "Waiting for first refresh";
  return `Updated ${new Date(f.lastUpdate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
