import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, Filter } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const statusOptions = [
  { value: "compliant", label: "Compliant", color: "bg-green-500/10 text-green-600 border-green-200" },
  { value: "partial", label: "Partial", color: "bg-yellow-500/10 text-yellow-600 border-yellow-200" },
  { value: "non_compliant", label: "Non-Compliant", color: "bg-red-500/10 text-red-600 border-red-200" },
  { value: "not_started", label: "Not Started", color: "bg-gray-500/10 text-gray-600 border-gray-200" },
];

const getStatusColor = (status: string) =>
  statusOptions.find(s => s.value === status)?.color || "bg-gray-500/10 text-gray-600";

const priorityFromWeight = (weight: number) => {
  if (weight >= 9) return { label: "Critical", color: "bg-red-500/10 text-red-600" };
  if (weight >= 7) return { label: "High", color: "bg-orange-500/10 text-orange-600" };
  if (weight >= 5) return { label: "Medium", color: "bg-yellow-500/10 text-yellow-600" };
  return { label: "Low", color: "bg-blue-500/10 text-blue-600" };
};

export default function Compliance() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const { data, isLoading } = useQuery<{ items: any[]; score: number }>({
    queryKey: ["/api/compliance"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PUT", `/api/compliance/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Status updated", description: "Compliance item has been updated." });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  const items = data?.items || [];
  const score = data?.score || 0;

  const filtered = items.filter(item => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    const p = priorityFromWeight(item.weight || 5);
    if (priorityFilter !== "all" && p.label.toLowerCase() !== priorityFilter) return false;
    return true;
  });

  const statusCounts = {
    compliant: items.filter(i => i.status === "compliant").length,
    partial: items.filter(i => i.status === "partial").length,
    non_compliant: items.filter(i => i.status === "non_compliant").length,
    not_started: items.filter(i => i.status === "not_started").length,
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold" data-testid="text-compliance-title">NDPR Compliance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your school's data protection compliance status</p>
      </div>

      {/* Score Card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Overall Compliance Score</p>
                <p className="text-2xl font-bold" data-testid="text-compliance-score-main">{score}%</p>
              </div>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="text-center">
                <p className="font-semibold text-green-600">{statusCounts.compliant}</p>
                <p className="text-muted-foreground">Compliant</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-yellow-600">{statusCounts.partial}</p>
                <p className="text-muted-foreground">Partial</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-red-600">{statusCounts.non_compliant}</p>
                <p className="text-muted-foreground">Non-Compliant</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-600">{statusCounts.not_started}</p>
                <p className="text-muted-foreground">Not Started</p>
              </div>
            </div>
          </div>
          <Progress value={score} className="h-2" />
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-status-filter">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusOptions.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-priority-filter">
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} items</span>
      </div>

      {/* Compliance Items */}
      <div className="space-y-3">
        {filtered.map((item) => {
          const priority = priorityFromWeight(item.weight || 5);
          return (
            <Card key={item.id} data-testid={`card-compliance-${item.id}`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium">{item.title}</h3>
                      <Badge variant="outline" className={`text-[10px] ${priority.color}`}>{priority.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <div className="flex items-center gap-2 sm:flex-shrink-0">
                    <Badge variant="outline" className={`text-[10px] ${getStatusColor(item.status)}`}>
                      {statusOptions.find(s => s.value === item.status)?.label || item.status}
                    </Badge>
                    <Select
                      value={item.status}
                      onValueChange={(value) => updateMutation.mutate({ id: item.id, status: value })}
                    >
                      <SelectTrigger className="w-32 h-7 text-[10px]" data-testid={`select-compliance-status-${item.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
