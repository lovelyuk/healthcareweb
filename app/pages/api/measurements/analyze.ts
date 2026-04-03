import { NextApiRequest, NextApiResponse } from 'next';

const AI_SERVER_URL = 'http://localhost:5000/api/body/summary';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  try {
    const { mergedAnalysis, subjectNo } = req.body;
    
    // Attempt to use the local AI Python server first
    try {
      const aiRes = await fetch(AI_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mergedAnalysis || {})
      });
      
      if (aiRes.ok) {
        const json = await aiRes.json();
        if (json && json.success) {
          return res.status(200).json({ aiSummary: json.summary });
        }
      }
    } catch (aiErr) {
      console.warn('[API Analyze] Local AI server not reachable, falling back to rule-based summary.');
    }

    // Fallback: Simple rule-based summary generation
    let summary = "회원님의 자세 분석 결과입니다.\n\n";

    if (mergedAnalysis) {
      const headTilt = Math.abs(mergedAnalysis.head_tilt?.value || 0);
      const shoulderSlope = Math.abs(mergedAnalysis.shoulder_slope?.value || 0);
      const score = 100 - (headTilt > 5 ? 10 : 0) - (shoulderSlope > 5 ? 10 : 0);

      summary += `- 자세 점수: ${score}점\n`;
      if (mergedAnalysis.head_tilt?.value > 7) summary += "- 머리가 왼쪽으로 기울어진 경향이 있습니다.\n";
      else if (mergedAnalysis.head_tilt?.value < -7) summary += "- 머리가 오른쪽으로 기울어진 경향이 있습니다.\n";
      else summary += "- 머리의 정렬상태가 양호합니다.\n";

      if (mergedAnalysis.shoulder_slope?.value > 7) summary += "- 어깨선이 오른쪽으로 올라간 불균형이 발견되었습니다.\n";
      else if (mergedAnalysis.shoulder_slope?.value < -7) summary += "- 어깨선이 왼쪽으로 올라간 불균형이 발견되었습니다.\n";
      else summary += "- 어깨의 수평 정렬이 균형적입니다.\n";

      const neck = mergedAnalysis.head_neck_shape?.value || 0;
      if (neck > 5) summary += "- 거북목 증상이 의심되므로 규칙적인 목 스트레칭을 권장합니다.\n";
    }

    summary += "\n전반적으로 고른 근력 발달과 바른 자세 유지가 필요합니다. 상세 리포트를 확인하시고 필요한 운동 처방을 받아보세요.";

    return res.status(200).json({ aiSummary: summary });
  } catch (err: any) {
    console.error('[API Analyze] Fatal error:', err);
    return res.status(500).json({ aiSummary: "분석 데이터를 처리하는 중 오류가 발생했습니다." });
  }
}
