import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: { tasks: true }
    });
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { taskId, completed, projectId, milestoneStage } = body;

    if (taskId) {
      const task = await prisma.projectTask.update({
        where: { id: taskId },
        data: { completed: Boolean(completed) }
      });

      // Recalculate project progress
      const allTasks = await prisma.projectTask.findMany({ where: { projectId: task.projectId } });
      const completedCount = allTasks.filter(t => t.completed).length;
      const progress = allTasks.length > 0 ? Math.round((completedCount / allTasks.length) * 100) : 0;

      await prisma.project.update({
        where: { id: task.projectId },
        data: { progress }
      });

      return NextResponse.json({ task, progress });
    }

    if (projectId && milestoneStage) {
      const project = await prisma.project.update({
        where: { id: projectId },
        data: { milestoneStage }
      });
      return NextResponse.json(project);
    }

    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  } catch (error) {
    console.error("Project API Error:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}
