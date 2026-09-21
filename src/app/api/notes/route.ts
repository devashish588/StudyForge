import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { todayStr } from "@/lib/date";

export async function GET() {
  try {
    const notes = await prisma.note.findMany({
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }]
    });
    return NextResponse.json(notes);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, content, tags, isPinned, isRevision, subjectId, projectId, topicId, questionId } = body;

    const note = await prisma.note.create({
      data: {
        title,
        content,
        tags: JSON.stringify(tags || []),
        isPinned: Boolean(isPinned),
        isRevision: Boolean(isRevision),
        ...(subjectId ? { subjectId: String(subjectId) } : {}),
        ...(projectId ? { projectId: String(projectId) } : {}),
        ...(topicId ? { topicId: String(topicId) } : {}),
        ...(questionId ? { questionId: String(questionId) } : {}),
      }
    });

    if (isRevision) {
      await prisma.revisionItem.create({
        data: {
          title: `Note: ${title}`,
          category: "Notes",
          sourceId: note.id,
          sourceType: "NOTE",
          confidence: 3,
          nextRevisionDate: todayStr(),
          notes: content.slice(0, 150)
        }
      });
    }

    return NextResponse.json(note);
  } catch (error) {
    console.error("Notes API Error:", error);
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, isPinned, isRevision, title, content, subjectId, projectId, topicId, questionId } = body;

    const updatedNote = await prisma.note.update({
      where: { id },
      data: {
        ...(isPinned !== undefined && { isPinned }),
        ...(isRevision !== undefined && { isRevision }),
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(subjectId !== undefined && { subjectId: subjectId || null }),
        ...(projectId !== undefined && { projectId: projectId || null }),
        ...(topicId !== undefined && { topicId: topicId || null }),
        ...(questionId !== undefined && { questionId: questionId || null }),
      }
    });

    return NextResponse.json(updatedNote);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Note id required" }, { status: 400 });
    await prisma.note.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
