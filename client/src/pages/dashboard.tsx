import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck, AlertTriangle, FileWarning, GraduationCap,
  ArrowRight, ExternalLink, Radio,
} from "lucide-react";
import { Link } from "wouter";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
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

export default function Dashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ["/api/dashboard"],
  });

  const { data: newsData } = useQuery<any[]>({
    queryKey: ["/api/news"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const complianceData = [
    { name: "Compliant", value: stats?.complianceScore || 0, color: "hsl(160, 84%, 39%)" },
    { name: "Remaining", value: 100 - (stats?.complianceScore || 0), color: "hsl(214, 15%, 88%)" },
  ];

  const threatChartData = stats?.threatStats ? [
    { name: "Critical", count: stats.threatStats.critical, fill: "hsl(0, 84%, 42%)" },
    { name: "High", count: stats.threatStats.high, fill: "hsl(25, 95%, 53%)" },
    { name: "Medium", count: stats.threatStats.medium, fill: "hsl(38, 92%, 50%)" },
    { name: "Low", count: stats.threatStats.low, fill: "hsl(217, 55%, 55%)" },
  ] : [];

  const news = newsData?.slice(0, 6) || [];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground" data-testid="text-dashboard-title">
          Welcome back, {user?.name?.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Security overview for your institution
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">NDPR Compliance</p>
                <p className="text-2xl font-semibold mt-1" data-testid="text-compliance-score">{stats?.complianceScore || 0}%</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {(stats?.complianceScore || 0) >= 80 ? "Good standing" : "Needs attention"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Active Threats</p>
                <p className="text-2xl font-semibold mt-1" data-testid="text-active-threats">{stats?.activeThreats || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.totalThreats || 0} total monitored
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Active Incidents</p>
                <p className="text-2xl font-semibold mt-1" data-testid="text-active-incidents">{stats?.activeIncidents || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <FileWarning className="w-5 h-5 text-orange-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.totalIncidents || 0} total reported
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Training Progress</p>
                <p className="text-2xl font-semibold mt-1" data-testid="text-training-completion">{stats?.trainingCompletion || 0}%</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.completedCourses || 0} of {stats?.totalCourses || 0} courses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Link href="/compliance">
          <Button variant="outline" size="sm" data-testid="button-quick-compliance">
            <ShieldCheck className="w-4 h-4 mr-2" /> Run Compliance Audit
          </Button>
        </Link>
        <Link href="/incidents">
          <Button variant="outline" size="sm" data-testid="button-quick-incident">
            <FileWarning className="w-4 h-4 mr-2" /> Report Incident
          </Button>
        </Link>
        <Link href="/training">
          <Button variant="outline" size="sm" data-testid="button-quick-training">
            <GraduationCap className="w-4 h-4 mr-2" /> Start Training
          </Button>
        </Link>
      </div>

      {/* Charts + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Compliance Gauge */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={complianceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    stroke="none"
                  >
                    {complianceData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute text-center">
                <p className="text-2xl font-bold">{stats?.complianceScore || 0}%</p>
                <p className="text-xs text-muted-foreground">NDPR Score</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Threat Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Threat Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={threatChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={50} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {threatChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent Incidents */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Recent Incidents</CardTitle>
            <Link href="/incidents">
              <Button variant="ghost" size="sm" className="text-xs h-7" data-testid="link-view-all-incidents">
                View All <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats?.recentIncidents?.slice(0, 4).map((inc: any) => (
              <div key={inc.id} className="flex items-start gap-3">
                <Badge variant="outline" className={`text-[10px] ${severityColors[inc.severity] || ""} shrink-0`}>
                  {inc.severity}
                </Badge>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{inc.description.substring(0, 60)}...</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className={`text-[10px] h-4 ${statusColors[inc.status] || ""}`}>
                      {inc.status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {inc.createdAt ? format(new Date(inc.createdAt), "MMM d") : ""}
                    </span>
                  </div>
                </div>
              </div>
            )) || <p className="text-xs text-muted-foreground">No recent incidents</p>}
          </CardContent>
        </Card>
      </div>

      {/* Cybersecurity News */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Cybersecurity News</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {news.map((article: any, i: number) => (
              <div key={i} className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-medium text-muted-foreground">{article.source}</span>
                  {article.isLive && (
                    <span className="flex items-center gap-1 text-[10px] text-primary">
                      <Radio className="w-3 h-3" /> LIVE
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium line-clamp-2">{article.title}</p>
                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{article.summary}</p>
                {article.url && (
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-1"
                  >
                    Read more <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
