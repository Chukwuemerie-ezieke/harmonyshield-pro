import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, ShieldCheck, AlertTriangle, GraduationCap, Clock } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

export default function Reports() {
  const { toast } = useToast();

  const { data: dashboard } = useQuery<any>({ queryKey: ["/api/dashboard"] });
  const { data: complianceData } = useQuery<any>({ queryKey: ["/api/compliance"] });
  const { data: threats } = useQuery<any[]>({ queryKey: ["/api/threats"] });
  const { data: incidents } = useQuery<any[]>({ queryKey: ["/api/incidents"] });
  const { data: courses } = useQuery<any[]>({ queryKey: ["/api/training/courses"] });
  const { data: progress } = useQuery<any[]>({ queryKey: ["/api/training/progress"] });
  const { data: auditLog, isLoading } = useQuery<any[]>({ queryKey: ["/api/audit"] });

  const handleExport = (type: string) => {
    toast({
      title: "Export initiated",
      description: `${type} export requires backend configuration. Contact your administrator.`,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const compItems = complianceData?.items || [];
  const statusCounts = {
    compliant: compItems.filter((i: any) => i.status === "compliant").length,
    partial: compItems.filter((i: any) => i.status === "partial").length,
    non_compliant: compItems.filter((i: any) => i.status === "non_compliant").length,
    not_started: compItems.filter((i: any) => i.status === "not_started").length,
  };

  const complianceChartData = [
    { name: "Compliant", count: statusCounts.compliant, fill: "hsl(160, 84%, 39%)" },
    { name: "Partial", count: statusCounts.partial, fill: "hsl(38, 92%, 50%)" },
    { name: "Non-Compliant", count: statusCounts.non_compliant, fill: "hsl(0, 84%, 42%)" },
    { name: "Not Started", count: statusCounts.not_started, fill: "hsl(217, 20%, 60%)" },
  ];

  const seedThreats = threats?.filter(t => !t.isLive) || [];
  const threatsBySeverity = [
    { name: "Critical", count: seedThreats.filter(t => t.severity === "critical").length, fill: "hsl(0, 84%, 42%)" },
    { name: "High", count: seedThreats.filter(t => t.severity === "high").length, fill: "hsl(25, 95%, 53%)" },
    { name: "Medium", count: seedThreats.filter(t => t.severity === "medium").length, fill: "hsl(38, 92%, 50%)" },
    { name: "Low", count: seedThreats.filter(t => t.severity === "low").length, fill: "hsl(217, 55%, 55%)" },
  ];

  const allIncidents = incidents || [];
  const incidentsByStatus = [
    { name: "Open", count: allIncidents.filter(i => i.status === "open").length, fill: "hsl(0, 84%, 42%)" },
    { name: "Investigating", count: allIncidents.filter(i => i.status === "investigating").length, fill: "hsl(25, 95%, 53%)" },
    { name: "Contained", count: allIncidents.filter(i => i.status === "contained").length, fill: "hsl(38, 92%, 50%)" },
    { name: "Resolved", count: allIncidents.filter(i => i.status === "resolved").length, fill: "hsl(160, 84%, 39%)" },
    { name: "Closed", count: allIncidents.filter(i => i.status === "closed").length, fill: "hsl(217, 20%, 60%)" },
  ];

  const totalCourses = courses?.length || 0;
  const completedCourses = progress?.filter(p => p.status === "completed").length || 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-reports-title">Reports & Audit</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Compliance reports, analytics, and audit trail</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => handleExport("Full Report")} data-testid="button-export-report">
          <Download className="w-4 h-4 mr-2" /> Export Report
        </Button>
      </div>

      <Tabs defaultValue="compliance">
        <TabsList>
          <TabsTrigger value="compliance" data-testid="tab-compliance">Compliance</TabsTrigger>
          <TabsTrigger value="threats" data-testid="tab-threats">Threats</TabsTrigger>
          <TabsTrigger value="incidents" data-testid="tab-incidents">Incidents</TabsTrigger>
          <TabsTrigger value="training" data-testid="tab-training">Training</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="compliance" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" /> Compliance Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={complianceChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {complianceChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Overall Score</span>
                  <span className="text-lg font-bold text-primary">{complianceData?.score || 0}%</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>Total Items</span><span className="font-medium">{compItems.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-green-600">Compliant</span><span className="font-medium">{statusCounts.compliant}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-yellow-600">Partial</span><span className="font-medium">{statusCounts.partial}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-red-600">Non-Compliant</span><span className="font-medium">{statusCounts.non_compliant}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Not Started</span><span className="font-medium">{statusCounts.not_started}</span>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => handleExport("Compliance")} data-testid="button-export-compliance">
                  <Download className="w-3 h-3 mr-1" /> Export Compliance Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="threats" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" /> Threat Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={threatsBySeverity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {threatsBySeverity.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Incident Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incidentsByStatus}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {incidentsByStatus.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-blue-500" /> Training Completion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Completion Rate</span>
                <span className="text-lg font-bold">{totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0}%</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Total Courses</span><span className="font-medium">{totalCourses}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>Completed</span><span className="font-medium text-green-600">{completedCourses}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span>In Progress</span><span className="font-medium text-yellow-600">{progress?.filter(p => p.status === "in_progress").length || 0}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" /> Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {auditLog?.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No audit entries</p>
                )}
                {auditLog?.map((entry: any) => (
                  <div key={entry.id} className="flex items-start gap-3 p-2 rounded hover:bg-accent/50 transition-colors" data-testid={`audit-entry-${entry.id}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium">{entry.action?.replace(/_/g, " ")}</p>
                      <p className="text-[10px] text-muted-foreground">{entry.details}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {entry.timestamp ? format(new Date(entry.timestamp), "MMM d, yyyy HH:mm") : ""}
                      </p>
                    </div>
                    {entry.entityType && (
                      <Badge variant="outline" className="text-[10px]">{entry.entityType}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
