const GEMINI_MODEL = "Gemini 3.1 Flash Lite";

const responseSchema = {
  type: "object",
  required: ["strategy", "firstAction", "risks", "encouragement", "schedule"],
  properties: {
    strategy: { type: "string", description: "완료 전략을 2~4문장으로 설명" },
    firstAction: { type: "string", description: "사용자가 지금 즉시 시작할 10~20분 행동" },
    risks: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string" },
    },
    encouragement: { type: "string", description: "압박감은 주되 공격적이지 않은 짧은 격려" },
    schedule: {
      type: "array",
      minItems: 2,
      maxItems: 14,
      items: {
        type: "object",
        required: ["startAt", "title", "description"],
        properties: {
          startAt: { type: "string", description: "ISO 8601 형식의 현지 시각" },
          title: { type: "string" },
          description: { type: "string" },
        },
      },
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST 요청만 허용됩니다." });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "서버에 GEMINI_API_KEY 환경변수가 설정되지 않았습니다." });
  }

  const { task, deadline, progress, availableHours, timePreference, notes, timezone } = req.body || {};

  if (!task || !deadline) {
    return res.status(400).json({ error: "해야 할 일과 최종 기한을 모두 입력해주세요." });
  }

  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime()) || deadlineDate.getTime() <= Date.now()) {
    return res.status(400).json({ error: "최종 기한은 현재 시각보다 이후여야 합니다." });
  }

  const nowIso = new Date().toISOString();
  const prompt = `
당신은 마감이 임박한 사용자를 돕는 현실적인 일정 코치입니다.
사용자가 실제로 완료할 수 있도록 남은 시간을 작업 단위로 쪼개고, 각 작업의 시작 시각을 지정하세요.

[현재 정보]
- 현재 UTC 시각: ${nowIso}
- 사용자 시간대: ${timezone || "Asia/Seoul"}
- 해야 할 일: ${task}
- 최종 기한(사용자 현지 입력): ${deadline}
- 진행 상황: ${progress || "알 수 없음"}
- 하루 집중 가능 시간: ${availableHours || "2"}시간
- 선호 집중 시간대: ${timePreference || "상관없음"}
- 추가 조건: ${notes || "없음"}

[계획 원칙]
1. 모든 schedule.startAt은 현재보다 미래이며 최종 기한보다 이전이어야 합니다.
2. 일정은 사용자 시간대를 고려한 ISO 8601 문자열로 작성하세요. 가능하면 시간대 오프셋을 포함하세요.
3. 첫 일정은 가능한 한 빠르게 배치하되, 사용자가 바로 실행할 수 있는 10~25분 준비 행동으로 만드세요.
4. 큰 작업은 조사, 초안, 제작, 검토, 제출처럼 명확한 단계로 나누세요.
5. 최종 기한 직전에는 반드시 검토·백업·제출 확인 시간을 확보하세요.
6. 설명은 한국어로 짧고 구체적으로 작성하세요.
7. 막연한 표현 대신 산출물이 보이는 행동을 사용하세요. 예: '작업하기'보다 '슬라이드 1~5장 초안 작성'.
`;

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.45,
        },
      }),
    });

    const geminiData = await geminiResponse.json();
    if (!geminiResponse.ok) {
      console.error("Gemini API error:", geminiData);
      const detail = geminiData?.error?.message || "Gemini API 호출에 실패했습니다.";
      return res.status(geminiResponse.status).json({ error: detail });
    }

    const text = geminiData?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
    if (!text) return res.status(502).json({ error: "Gemini가 계획을 반환하지 않았습니다." });

    const plan = JSON.parse(text);
    const normalizedSchedule = plan.schedule
      .map((item) => ({ ...item, startAt: new Date(item.startAt).toISOString() }))
      .filter((item) => {
        const time = new Date(item.startAt).getTime();
        return time > Date.now() && time < deadlineDate.getTime();
      })
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));

    if (!normalizedSchedule.length) {
      return res.status(502).json({ error: "유효한 미래 일정이 생성되지 않았습니다. 기한을 조금 늘려 다시 시도해주세요." });
    }

    return res.status(200).json({ ...plan, schedule: normalizedSchedule });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "계획 생성 중 서버 오류가 발생했습니다." });
  }
}
