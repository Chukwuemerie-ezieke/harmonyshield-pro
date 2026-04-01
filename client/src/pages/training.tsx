import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  GraduationCap, Clock, ChevronLeft, CheckCircle2, XCircle, ArrowRight,
  Shield, Mail, Lock, AlertTriangle, Globe, HardDrive,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRoute } from "wouter";

const iconMap: Record<string, any> = {
  Shield, Mail, Lock, AlertTriangle, Globe, HardDrive,
};

export default function Training() {
  const { toast } = useToast();
  const [, params] = useRoute("/training/:id");
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(params?.id ? Number(params.id) : null);
  const [quizMode, setQuizMode] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean } | null>(null);

  const { data: courses, isLoading } = useQuery<any[]>({
    queryKey: ["/api/training/courses"],
  });

  const { data: progress } = useQuery<any[]>({
    queryKey: ["/api/training/progress"],
  });

  const selectedCourse = courses?.find(c => c.id === selectedCourseId);

  const progressMutation = useMutation({
    mutationFn: async (data: { courseId: number; status: string; score?: number }) => {
      const res = await apiRequest("POST", "/api/training/progress", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const getProgressForCourse = (courseId: number) =>
    progress?.find(p => p.courseId === courseId);

  const handleStartCourse = (courseId: number) => {
    setSelectedCourseId(courseId);
    setQuizMode(false);
    setQuizResult(null);
    setAnswers({});
    progressMutation.mutate({ courseId, status: "in_progress" });
  };

  const handleStartQuiz = () => {
    setQuizMode(true);
    setAnswers({});
    setQuizResult(null);
  };

  const handleSubmitQuiz = () => {
    if (!selectedCourse?.quizJson) return;
    const quiz = JSON.parse(selectedCourse.quizJson);
    let correct = 0;
    quiz.forEach((q: any, i: number) => {
      if (answers[i] === q.correct) correct++;
    });
    const score = Math.round((correct / quiz.length) * 100);
    const passed = score >= (selectedCourse.passMark || 70);
    setQuizResult({ score, passed });

    progressMutation.mutate({
      courseId: selectedCourse.id,
      status: passed ? "completed" : "in_progress",
      score,
    });

    toast({
      title: passed ? "Congratulations!" : "Keep Trying",
      description: passed
        ? `You passed with ${score}%! Course completed.`
        : `You scored ${score}%. You need ${selectedCourse.passMark}% to pass.`,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  // Course detail view
  if (selectedCourse) {
    const courseProgress = getProgressForCourse(selectedCourse.id);
    let quiz: any[] = [];
    try {
      quiz = selectedCourse.quizJson ? JSON.parse(selectedCourse.quizJson) : [];
    } catch { quiz = []; }

    return (
      <div className="space-y-6 max-w-3xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setSelectedCourseId(null); setQuizMode(false); setQuizResult(null); }}
          data-testid="button-back-to-courses"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Courses
        </Button>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-semibold">{selectedCourse.title}</h1>
            {courseProgress?.status === "completed" && (
              <Badge className="bg-green-500/10 text-green-600">Completed</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {selectedCourse.durationMin} min</span>
            <span>Pass mark: {selectedCourse.passMark}%</span>
            {courseProgress?.score != null && <span>Your score: {courseProgress.score}%</span>}
          </div>
        </div>

        {!quizMode ? (
          <>
            {/* Course content */}
            <Card>
              <CardContent className="p-6 prose prose-sm max-w-none dark:prose-invert">
                {selectedCourse.contentMd?.split("\n").map((line: string, i: number) => {
                  if (line.startsWith("# ")) return <h1 key={i} className="text-lg font-bold mt-4 mb-2">{line.replace("# ", "")}</h1>;
                  if (line.startsWith("## ")) return <h2 key={i} className="text-base font-semibold mt-4 mb-2">{line.replace("## ", "")}</h2>;
                  if (line.startsWith("- ")) return <li key={i} className="text-sm ml-4">{line.replace("- ", "")}</li>;
                  if (line.match(/^\d+\./)) return <li key={i} className="text-sm ml-4 list-decimal">{line.replace(/^\d+\.\s*/, "")}</li>;
                  if (line.trim() === "") return <br key={i} />;
                  return <p key={i} className="text-sm mb-1">{line.replace(/\*\*(.*?)\*\*/g, "$1")}</p>;
                })}
              </CardContent>
            </Card>

            {quiz.length > 0 && (
              <Button onClick={handleStartQuiz} data-testid="button-start-quiz">
                Take Quiz <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </>
        ) : (
          <>
            {/* Quiz */}
            <div className="space-y-4">
              {quiz.map((q: any, qi: number) => (
                <Card key={qi} data-testid={`card-quiz-question-${qi}`}>
                  <CardContent className="p-4">
                    <p className="text-sm font-medium mb-3">
                      {qi + 1}. {q.question}
                    </p>
                    <div className="space-y-2">
                      {q.options.map((opt: string, oi: number) => {
                        const isSelected = answers[qi] === oi;
                        const isCorrect = quizResult && q.correct === oi;
                        const isWrong = quizResult && isSelected && q.correct !== oi;

                        return (
                          <button
                            key={oi}
                            type="button"
                            data-testid={`quiz-option-${qi}-${oi}`}
                            className={`w-full text-left text-sm px-3 py-2 rounded-md border transition-colors ${
                              isCorrect ? "border-green-500 bg-green-500/10" :
                              isWrong ? "border-red-500 bg-red-500/10" :
                              isSelected ? "border-primary bg-primary/10" :
                              "border-border hover:bg-accent"
                            }`}
                            onClick={() => {
                              if (!quizResult) {
                                setAnswers({ ...answers, [qi]: oi });
                              }
                            }}
                            disabled={!!quizResult}
                          >
                            <span className="flex items-center gap-2">
                              {isCorrect && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                              {isWrong && <XCircle className="w-4 h-4 text-red-500" />}
                              {opt}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {!quizResult ? (
                <Button
                  onClick={handleSubmitQuiz}
                  disabled={Object.keys(answers).length < quiz.length}
                  data-testid="button-submit-quiz"
                >
                  Submit Answers ({Object.keys(answers).length}/{quiz.length})
                </Button>
              ) : (
                <Card className={quizResult.passed ? "border-green-500/50" : "border-red-500/50"}>
                  <CardContent className="p-4 text-center">
                    {quizResult.passed ? (
                      <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    ) : (
                      <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    )}
                    <p className="text-lg font-bold">{quizResult.score}%</p>
                    <p className="text-sm text-muted-foreground">
                      {quizResult.passed ? "You passed! Course completed." : `You need ${selectedCourse.passMark}% to pass. Try again!`}
                    </p>
                    {!quizResult.passed && (
                      <Button variant="outline" size="sm" className="mt-3" onClick={handleStartQuiz} data-testid="button-retry-quiz">
                        Retry Quiz
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // Course list
  const totalCourses = courses?.length || 0;
  const completedCourses = progress?.filter(p => p.status === "completed").length || 0;
  const completionPct = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold" data-testid="text-training-title">Staff Training</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Cybersecurity awareness courses for school staff</p>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Training Progress</p>
                <p className="text-xs text-muted-foreground">{completedCourses} of {totalCourses} courses completed</p>
              </div>
            </div>
            <span className="text-lg font-bold">{completionPct}%</span>
          </div>
          <Progress value={completionPct} className="h-2" />
        </CardContent>
      </Card>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses?.map((course) => {
          const cp = getProgressForCourse(course.id);
          const Icon = iconMap[course.icon] || GraduationCap;
          const isCompleted = cp?.status === "completed";
          const isInProgress = cp?.status === "in_progress";

          return (
            <Card key={course.id} className="hover:shadow-md transition-shadow" data-testid={`card-course-${course.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  {isCompleted && (
                    <Badge className="bg-green-500/10 text-green-600 text-[10px]">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
                    </Badge>
                  )}
                  {isInProgress && (
                    <Badge className="bg-yellow-500/10 text-yellow-600 text-[10px]">In Progress</Badge>
                  )}
                </div>
                <h3 className="text-sm font-medium mb-1">{course.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{course.description}</p>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" /> {course.durationMin} min
                  </span>
                  <Button
                    variant={isCompleted ? "outline" : "default"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleStartCourse(course.id)}
                    data-testid={`button-start-course-${course.id}`}
                  >
                    {isCompleted ? "Review" : isInProgress ? "Continue" : "Start"}
                  </Button>
                </div>
                {cp?.score != null && (
                  <p className="text-xs text-muted-foreground mt-2">Score: {cp.score}%</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
