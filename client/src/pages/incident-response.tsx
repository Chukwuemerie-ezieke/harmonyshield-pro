import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileWarning, Plus, ChevronLeft, CheckCircle2, Clock, AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const severityColors: Record<string, string> = {
  critical: "bg-red-500/10 text-red-600 border-red-200",
  high: "bg-orange-500/10 text-orange-600 border-orange-200",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
  low: "bg-blue-500/10 text-blue-600 border-blue-200",
};

const statusColors: Record<string, string> = {
  open: "bg-red-500/10 text-red-600",
  investigating: "bg-orange-500/10 text-orange-600",
  contained: "bg-yellow-500/10 text-yellow-600",
  resolved: "bg-green-500/10 text-green-600",
  closed: "bg-gray-500/10 text-gray-600",
};

const statusFlow = ["open", "investigating", "contained", "resolved", "closed"];

export default function IncidentResponse() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showActionForm, setShowActionForm] = useState(false);

  // Form state
  const [newType, setNewType] = useState("phishing");
  const [newSeverity, setNewSeverity] = useState("medium");
  const [newDescription, setNewDescription] = useState("");
  const [newAffectedSystems, setNewAffectedSystems] = useState("");
  const [newAffectedCount, setNewAffectedCount] = useState("");

  // Action form
  const [actionText, setActionText] = useState("");
  const [actionNotes, setActionNotes] = useState("");

  const { data: incidents, isLoading } = useQuery<any[]>({
    queryKey: ["/api/incidents"],
  });

  const { data: incidentDetail } = useQuery<any>({
    queryKey: ["/api/incidents", selectedId],
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/incidents", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setShowNewForm(false);
      resetNewForm();
      toast({ title: "Incident reported", description: "The incident has been created." });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/incidents/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", selectedId] });
      toast({ title: "Incident updated" });
    },
  });

  const addActionMutation = useMutation({
    mutationFn: async ({ incidentId, data }: { incidentId: number; data: any }) => {
      const res = await apiRequest("POST", `/api/incidents/${incidentId}/actions`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents", selectedId] });
      setShowActionForm(false);
      setActionText("");
      setActionNotes("");
      toast({ title: "Action added" });
    },
  });

  const resetNewForm = () => {
    setNewType("phishing");
    setNewSeverity("medium");
    setNewDescription("");
    setNewAffectedSystems("");
    setNewAffectedCount("");
  };

  const handleCreate = () => {
    createMutation.mutate({
      reportedBy: user?.name || "Unknown",
      type: newType,
      severity: newSeverity,
      description: newDescription,
      affectedSystems: newAffectedSystems,
      affectedCount: parseInt(newAffectedCount) || 0,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  // Incident detail
  if (selectedId && incidentDetail) {
    const detail = incidentDetail;
    const currentIdx = statusFlow.indexOf(detail.status);
    const nextStatus = currentIdx < statusFlow.length - 1 ? statusFlow[currentIdx + 1] : null;

    return (
      <div className="space-y-6 max-w-4xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedId(null)}
          data-testid="button-back-to-incidents"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Incidents
        </Button>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-semibold">Incident #{detail.id}</h2>
                  <Badge variant="outline" className={severityColors[detail.severity]}>{detail.severity}</Badge>
                  <Badge variant="outline" className={statusColors[detail.status]}>{detail.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Reported by {detail.reportedBy} · {detail.createdAt ? format(new Date(detail.createdAt), "MMM d, yyyy HH:mm") : ""}
                </p>
              </div>
              {nextStatus && (
                <Button
                  size="sm"
                  onClick={() => updateMutation.mutate({ id: detail.id, data: { status: nextStatus } })}
                  data-testid="button-advance-status"
                >
                  Move to {nextStatus}
                </Button>
              )}
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-muted-foreground text-xs">Type</span>
                <p>{detail.type?.replace(/_/g, " ")}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground text-xs">Description</span>
                <p>{detail.description}</p>
              </div>
              <div className="flex gap-8">
                <div>
                  <span className="font-medium text-muted-foreground text-xs">Affected Systems</span>
                  <p>{detail.affectedSystems || "N/A"}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground text-xs">Affected Count</span>
                  <p>{detail.affectedCount || 0}</p>
                </div>
              </div>
            </div>

            {/* Status timeline */}
            <div className="flex items-center gap-2 mt-6 mb-4">
              {statusFlow.map((s, i) => {
                const isReached = i <= currentIdx;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                      isReached ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {isReached ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
                    </div>
                    <span className={`text-[10px] capitalize ${isReached ? "font-medium" : "text-muted-foreground"}`}>{s}</span>
                    {i < statusFlow.length - 1 && <div className={`w-6 h-px ${isReached ? "bg-primary" : "bg-muted"}`} />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Actions Timeline */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Response Actions</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowActionForm(true)} data-testid="button-add-action">
              <Plus className="w-3 h-3 mr-1" /> Add Action
            </Button>
          </CardHeader>
          <CardContent>
            {showActionForm && (
              <div className="mb-4 p-3 border rounded-lg space-y-3">
                <div>
                  <Label className="text-xs">Action</Label>
                  <Input
                    data-testid="input-action-text"
                    placeholder="Describe the action taken"
                    value={actionText}
                    onChange={(e) => setActionText(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    data-testid="input-action-notes"
                    placeholder="Additional notes"
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    className="text-xs"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => addActionMutation.mutate({
                      incidentId: detail.id,
                      data: { action: actionText, performedBy: user?.name || "Unknown", notes: actionNotes },
                    })}
                    disabled={!actionText}
                    data-testid="button-submit-action"
                  >
                    Save Action
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowActionForm(false)}>Cancel</Button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {detail.actions?.length === 0 && (
                <p className="text-xs text-muted-foreground">No actions recorded yet</p>
              )}
              {detail.actions?.map((action: any) => (
                <div key={action.id} className="flex gap-3 p-3 rounded-lg border">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    action.status === "completed" ? "bg-green-500/10" : "bg-yellow-500/10"
                  }`}>
                    {action.status === "completed" ? (
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    ) : (
                      <Clock className="w-3 h-3 text-yellow-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{action.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {action.performedBy} · {action.createdAt ? format(new Date(action.createdAt), "MMM d, HH:mm") : ""}
                    </p>
                    {action.notes && <p className="text-xs text-muted-foreground mt-1">{action.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Incident list
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-incidents-title">Incident Response</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track and manage cybersecurity incidents</p>
        </div>
        <Dialog open={showNewForm} onOpenChange={setShowNewForm}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-new-incident">
              <Plus className="w-4 h-4 mr-2" /> Report Incident
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report New Incident</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={newType} onValueChange={setNewType}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-incident-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phishing">Phishing</SelectItem>
                      <SelectItem value="malware">Malware</SelectItem>
                      <SelectItem value="ransomware">Ransomware</SelectItem>
                      <SelectItem value="unauthorized_access">Unauthorized Access</SelectItem>
                      <SelectItem value="data_breach">Data Breach</SelectItem>
                      <SelectItem value="ddos">DDoS</SelectItem>
                      <SelectItem value="insider_threat">Insider Threat</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Severity</Label>
                  <Select value={newSeverity} onValueChange={setNewSeverity}>
                    <SelectTrigger className="h-8 text-xs" data-testid="select-incident-severity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea
                  data-testid="input-incident-description"
                  placeholder="Describe the incident in detail..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="text-xs"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Affected Systems</Label>
                  <Input
                    data-testid="input-affected-systems"
                    placeholder="e.g. Email, Student DB"
                    value={newAffectedSystems}
                    onChange={(e) => setNewAffectedSystems(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs">Affected Count</Label>
                  <Input
                    data-testid="input-affected-count"
                    type="number"
                    placeholder="0"
                    value={newAffectedCount}
                    onChange={(e) => setNewAffectedCount(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <Button
                onClick={handleCreate}
                disabled={!newDescription || createMutation.isPending}
                data-testid="button-submit-incident"
                className="w-full"
              >
                {createMutation.isPending ? "Creating..." : "Submit Incident Report"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Incident list */}
      <div className="space-y-3">
        {incidents?.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <FileWarning className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No incidents reported yet</p>
            </CardContent>
          </Card>
        )}
        {incidents?.map((inc) => (
          <Card
            key={inc.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
            data-testid={`card-incident-${inc.id}`}
            onClick={() => setSelectedId(inc.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  inc.severity === "critical" ? "text-red-500" :
                  inc.severity === "high" ? "text-orange-500" :
                  inc.severity === "medium" ? "text-yellow-500" : "text-blue-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium">#{inc.id}</span>
                    <Badge variant="outline" className={`text-[10px] ${severityColors[inc.severity]}`}>{inc.severity}</Badge>
                    <Badge variant="outline" className={`text-[10px] ${statusColors[inc.status]}`}>{inc.status}</Badge>
                    <Badge variant="outline" className="text-[10px]">{inc.type?.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{inc.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                    <span>Reported by {inc.reportedBy}</span>
                    <span>{inc.createdAt ? format(new Date(inc.createdAt), "MMM d, yyyy") : ""}</span>
                    {inc.affectedSystems && <span>{inc.affectedSystems}</span>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
