import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { todayStr, addDays } from "@/lib/date";
export async function GET() {
  try {
    const subjects = await prisma.gateSubject.findMany({
      include: {
        topics: true,
        questions: { take: 10, orderBy: { createdAt: "desc" } }
      }
    });

    const errorLogs = await prisma.gateErrorLog.findMany({
      orderBy: { createdAt: "desc" }
    });

    const mockTests = await prisma.gateMockTest.findMany({
      orderBy: { date: "desc" }
    });

    return NextResponse.json({ subjects, errorLogs, mockTests });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch GATE data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, payload } = body;

    if (action === "LOG_PYQ") {
      const { subjectId, topicName, year, questionNo, difficulty, correct, timeMinutes, confidence, mistakeType, explanation } = payload;

      const question = await prisma.gateQuestion.create({
        data: {
          subjectId,
          topicName: topicName || "General",
          year: Number(year) || 2024,
          questionNo: Number(questionNo) || 1,
          difficulty: difficulty || "Medium",
          attempted: true,
          correct: Boolean(correct),
          timeMinutes: Number(timeMinutes) || 5,
          confidence: Number(confidence) || 3,
          mistakeType: mistakeType || null,
          explanation: explanation || null
        }
      });

      // Update subject PYQ counter & accuracy
      const subject = await prisma.gateSubject.findUnique({ where: { id: subjectId } });
      if (subject) {
        const newSolved = subject.solvedPYQs + 1;
        const allQuestions = await prisma.gateQuestion.findMany({ where: { subjectId, attempted: true } });
        const correctCount = allQuestions.filter(q => q.correct).length;
        const newAccuracy = allQuestions.length > 0 ? Number(((correctCount / allQuestions.length) * 100).toFixed(1)) : 0;

        await prisma.gateSubject.update({
          where: { id: subjectId },
          data: {
            solvedPYQs: newSolved,
            accuracy: newAccuracy
          }
        });

        // Automatically log error if question was wrong
        if (!correct && mistakeType) {
          await prisma.gateErrorLog.create({
            data: {
              questionId: question.id,
              subject: subject.name,
              topic: topicName || "General",
              mistakeType,
              rootCause: explanation || `Got question #${questionNo} wrong. Mistake category: ${mistakeType}`,
              correctConcept: "Revisit theoretical concept & practice similar problem pattern.",
              retryDate: addDays(todayStr(), 2),
              status: "OPEN"
            }
          });
        }
      }

      return NextResponse.json(question);
    }

    if (action === "LOG_MOCK") {
      const { testName, durationMinutes, attempted, correct, incorrect, marks, weakAreas } = payload;
      const att = Number(attempted) || 0;
      const corr = Number(correct) || 0;
      const acc = att > 0 ? Number(((corr / att) * 100).toFixed(1)) : 0;

      const mock = await prisma.gateMockTest.create({
        data: {
          testName: testName || "GATE Full Length Mock",
          date: todayStr(),
          durationMinutes: Number(durationMinutes) || 180,
          attempted: att,
          correct: corr,
          incorrect: Number(incorrect) || 0,
          marks: Number(marks) || 0,
          accuracy: acc,
          weakAreas: JSON.stringify(weakAreas || [])
        }
      });

      return NextResponse.json(mock);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("GATE API POST Error:", error);
    return NextResponse.json({ error: "Failed to process GATE request" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { errorId, status, topicCompleted, topicId, topicConfidence } = body;

    if (errorId && status) {
      if (!["OPEN", "REVISED", "RESOLVED"].includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      const updated = await prisma.gateErrorLog.update({ where: { id: errorId }, data: { status } });
      return NextResponse.json(updated);
    }

    if (topicId && (topicCompleted !== undefined || topicConfidence !== undefined)) {
      const updated = await prisma.gateTopic.update({
        where: { id: topicId },
        data: {
          ...(topicCompleted !== undefined && {
            completed: Boolean(topicCompleted),
            // Stamp completion date so pace engine can measure topics/day honestly.
            completedAt: topicCompleted ? todayStr() : null,
          }),
          ...(topicConfidence !== undefined && { confidence: Number(topicConfidence) }),
          // Any touch counts as studied (drives "stale topic" priority).
          lastStudied: todayStr(),
        },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  } catch (error) {
    console.error("GATE API PATCH Error:", error);
    return NextResponse.json({ error: "Failed to update GATE record" }, { status: 500 });
  }
}
