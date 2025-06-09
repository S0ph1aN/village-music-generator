// app/api/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';

// 简单内存存储（实际应用中应使用数据库）
const taskStore = new Map<string, string>();

export async function POST(req: NextRequest) {
  const data = await req.json();//解析请求提JSON数据
  //只处理sunoAPI回调
  if (data.callbackType === 'complete' && data.data?.[0]?.audio_url) {
    const taskId = data.task_id;//获取任务ID
    const audioUrl = data.data[0].audio_url;//获取音频URL
    // 存储音频URL
    taskStore.set(taskId, audioUrl);//URL存储在内存中
  }
  
  return NextResponse.json({ success: true });//返回成功响应
}

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get('taskId');//从查询参数获取taskId
  
  if (!taskId) {
    return NextResponse.json({ error: '缺少taskId参数' }, { status: 400 });
  }
  
  const audioUrl = taskStore.get(taskId);//从内存取音频URL
  
  if (!audioUrl) {
    return NextResponse.json({ status: 'processing' });//状态为任务仍在处理
  }
  
  return NextResponse.json({ status: 'complete', audioUrl });//返回完成状态和URL
}