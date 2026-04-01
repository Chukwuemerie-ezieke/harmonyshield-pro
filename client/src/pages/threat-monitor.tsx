import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, Radio, ExternalLink, Search, Shield, Globe, Loader2,
} from "lucide-react";
import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const severityColors: Record<string, string> = {
  critical: "bg-red-500/10 text-red-600 border-red-200",
  high: "bg-orange-500/10 text-orange-600 border-orange-200",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
  low: "bg-blue-500/10 text-blue-600 border-blue-200",
};

const CHART_COLORS = ["hsl(0, 84%, 42%)", "hsl(25, 95%, 53%)", "hsl(38, 92%, 50%)", "hsl(217, 55%, 55%)", "hsl(160, 84%, 39%)"];

export default function ThreatMonitor() {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [ipAddress, setIpAddress] = useState("");

  const { data: threats, isLoading } = useQuery<any[]>({
    queryKey: ["/api/threats"],
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/threats/stats"],
  });

  const ipCheckMutation = useMutation({
    mutationFn: async (ip: string) => {
      const res = await apiRequest("GET", `/api/ip-check/${ip}`);
      return res.json();
    },
  });

  const allThreats = threats || [];
  const types = [...new Set(allThreats.map(t => t.type))];

  const filtered = allThreats.filter(t => {
    if (severityFilter !== "all" && t.severity !== severityFilter) return false;
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    return true;
  });

  // Threat type distribution for pie chart
  const typeDistribution = types.map(type => ({
    name: type.replace(/_/g, " "),
    value: allThreats.filter(t => t.type === type).length,
  }));

  const handleIPCheck = () => {
    if (ipAddress.trim()) {
      ipCheckMutation.mutate(ipAddress.trim());
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-6xl">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold" data-testid="text-threats-title">Threat Monitor</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Real-time cybersecurity threat intelligence</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold" data-testid="text-total-threats">{stats?.total || allThreats.length}</p>
            <p className="text-xs text-muted-foreground">Total Threats</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600" data-testid="text-critical-threats">{stats?.critical || 0}</p>
            <p className="text-xs text-muted-foreground">Critical</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{stats?.high || 0}</p>
            <p className="text-xs text-muted-foreground">High</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{(stats?.medium || 0) + (stats?.low || 0)}</p>
            <p className="text-xs text-muted-foreground">Medium/Low</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main threat list */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-severity-filter">
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-type-filter">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {types.map(t => (
                  <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto self-center">{filtered.length} threats</span>
          </div>

          {/* Threat Cards */}
          <div className="space-y-3">
            {filtered.slice(0, 20).map((threat: any, i: number) => (
              <Card key={threat.id || i} data-testid={`card-threat-${threat.id || i}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                      threat.severity === "critical" ? "text-red-500" :
                      threat.severity === "high" ? "text-orange-500" :
                      threat.severity === "medium" ? "text-yellow-500" : "text-blue-500"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-sm font-medium">{threat.title}</h3>
                        {threat.isLive && (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
                            <Radio className="w-3 h-3" /> LIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{threat.description}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${severityColors[threat.severity] || ""}`}>
                          {threat.severity}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {threat.type?.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{threat.source}</span>
                        {threat.country && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Globe className="w-3 h-3" /> {threat.country}
                          </span>
                        )}
                        {threat.pulseUrl && (
                          <a
                            href={threat.pulseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                          >
                            View Pulse <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Threat Type Distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Threat Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {typeDistribution.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* IP Reputation Checker */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="w-4 h-4" /> IP Reputation Check
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  data-testid="input-ip-address"
                  placeholder="e.g. 8.8.8.8"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  className="h-8 text-xs"
                  onKeyDown={(e) => e.key === "Enter" && handleIPCheck()}
                />
                <Button
                  size="sm"
                  onClick={handleIPCheck}
                  disabled={ipCheckMutation.isPending}
                  data-testid="button-check-ip"
                  className="h-8"
                >
                  {ipCheckMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                </Button>
              </div>

              {ipCheckMutation.data && (
                <div className="p-3 rounded-lg border bg-card text-xs space-y-1" data-testid="ip-result">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IP</span>
                    <span className="font-medium">{ipCheckMutation.data.ip}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Abuse Score</span>
                    <span className={`font-bold ${
                      ipCheckMutation.data.abuseConfidenceScore > 50 ? "text-red-600" : "text-green-600"
                    }`}>{ipCheckMutation.data.abuseConfidenceScore}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Risk Level</span>
                    <Badge variant="outline" className={`text-[10px] ${severityColors[ipCheckMutation.data.riskLevel] || ""}`}>
                      {ipCheckMutation.data.riskLevel}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Country</span>
                    <span>{ipCheckMutation.data.countryCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ISP</span>
                    <span className="truncate ml-2">{ipCheckMutation.data.isp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reports</span>
                    <span>{ipCheckMutation.data.totalReports}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
