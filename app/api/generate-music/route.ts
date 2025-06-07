import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { title, lyrics } = await request.json();
  
  try {
    // 实际调用SunoAI API的部分
    const SUNO_API_KEY = process.env.SUNO_API_KEY;
    
    // 这里需要您替换为真实的SunoAI API调用
    const response = await fetch('https://api.suno.ai/v1/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUNO_API_KEY}`
      },
      body: JSON.stringify({
        title,
        lyrics,
        style: "folk",
        duration: 180
      })
    });

    const data = await response.json();
    return NextResponse.json({ audioUrl: data.audio_url });
    
  } catch (error) {
    console.error("SunoAI生成失败:", error);
    return NextResponse.json(
      { error: "音乐生成失败" },
      { status: 500 }
    );
  }
}